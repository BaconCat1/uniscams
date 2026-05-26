/* ========================================================
   API & DATA LAYER (api.js)
   ======================================================== */
let uuids = [];
let altMap = {};
let manualAlts = {};
let discordLinks = {};
let serverTags = {};
let discordData = {};
let discordFallbackData = {};
let unlinked = [];

const players = new Map();
const failedPlayers = new Set();

const PLAYER_TTL = 1000 * 60 * 60 * 6; // 6 Hours cache TTL
const DISCORD_TTL = 1000 * 60 * 60 * 6; // 6 Hours cache TTL for Discord

const wait = (ms) => new Promise(r => setTimeout(r, ms));

/* FETCH MANIFEST/CONFIGS */
async function loadConfig() {
    const res = await fetch("./data.json");
    if (!res.ok) throw new Error("data.json failed");

    const data = await res.json();
    uuids = data.uuids || [];
    altMap = data.altMap || {};
    manualAlts = data.manualAlts || {};
    discordLinks = data.discordLinks || {};
    serverTags = data.serverTags || {};
    unlinked = data.unlinked || [];

    // Expose globally for ui.js card rendering
    window.unlinked = unlinked;
}

async function loadDiscordData() {
    const res = await fetch("./discord.json");
    discordFallbackData = res.ok ? await res.json() : {};
    
    // Initialize the main data pool with the fallback.
    // Live fetching will selectively overwrite these keys.
    discordData = { ...discordFallbackData };
    if (discordFallbackData.users) {
        discordData = { ...discordData, ...discordFallbackData.users };
    }
}

/* LOCALSTORAGE CACHING PIPELINE */
function getCachedPlayer(uuid) {
    const raw = localStorage.getItem(`player:${uuid}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.time > PLAYER_TTL) {
        localStorage.removeItem(`player:${uuid}`);
        return null;
    }
    return parsed.data;
}

function setCachedPlayer(uuid, data) {
    localStorage.setItem(`player:${uuid}`, JSON.stringify({
        time: Date.now(),
        data: data
    }));
}

/* ========================================================
   LIVE DISCORD RESOLUTION & METRICS ENGINE
   ======================================================== */

function getCachedDiscordUser(id) {
    const raw = localStorage.getItem(`discord:${id}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.time > DISCORD_TTL) {
        localStorage.removeItem(`discord:${id}`);
        return null;
    }
    return parsed.data;
}

function setCachedDiscordUser(id, data) {
    localStorage.setItem(`discord:${id}`, JSON.stringify({
        time: Date.now(),
        data: data
    }));
}

async function fetchLiveDiscordUser(id) {
    const cached = getCachedDiscordUser(id);
    if (cached) return cached;

    try {
        // REPAIRED: Correct production URL endpoint for JAPI Discord resolution
        const res = await fetch(`https://japi.rest/discord/v1/user/${id}`);
        if (!res.ok) return null;
        
        const json = await res.json();
        const data = json.data; 
        
        if (data && data.id) {
            setCachedDiscordUser(id, data);
        }
        return data;
    } catch (e) {
        return null; // Silent fail to fallback
    }
}

async function resolveDiscordUsers(ids) {
    const resolveStart = performance.now();
    let successCount = 0;
    let failCount = 0;
    const total = ids.length;

    // Process in chunks of 10 to avoid blasting the API and getting rate limited
    const chunkSize = 10;
    for (let i = 0; i < total; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (id) => {
            const liveData = await fetchLiveDiscordUser(id);
            if (liveData) {
                discordData[id] = liveData; // Overwrite fallback with live payload
                successCount++;
                if (window.DEBUG) console.log(`[uniscams] discord resolved: ${liveData.username ?? liveData.global_name ?? id} (${id})`);
            } else {
                failCount++;
                if (window.DEBUG) console.log(`[uniscams] discord failed to resolve: ${id}`);
            }
        }));
    }

    const resolveMs = performance.now() - resolveStart;
    const resolveSec = (resolveMs / 1000).toFixed(2);
    console.log(`[uniscams] resolved ${successCount}/${total} discord accounts in ${resolveSec}s (${failCount} failed)`);
}

/* Rate limit pause setup */
let rateLimitPause = null;
const RATE_LIMITED = Symbol("RATE_LIMITED");
window._craftyRateLimited = RATE_LIMITED; 

function _setRateLimitPause(headers) {
    if (rateLimitPause) return; 
    const reset  = headers && headers.get("x-ratelimit-reset");
    const waitMs = reset
        ? Math.max(0, new Date(reset).getTime() - Date.now())
        : parseInt((headers && headers.get("retry-after")) || "10", 10) * 1000;
    if (window.DEBUG) console.log(`[uniscams] rate-limit pause ${(waitMs / 1000).toFixed(1)}s`);
    rateLimitPause = wait(waitMs).then(() => { rateLimitPause = null; });
}

function getRateLimitPause() { return rateLimitPause; }

/* CRAFTY API CALLER */
async function fetchPlayer(uuid) {
    const cached = getCachedPlayer(uuid);
    if (cached) return cached;

    if (rateLimitPause) await rateLimitPause;

    try {
        const res = await fetch(`https://api.crafty.gg/api/v2/players/${uuid}`);

        if (res.status === 429) {
            _setRateLimitPause(res.headers);
            return RATE_LIMITED; 
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!json?.data) throw new Error("Bad response");

        setCachedPlayer(uuid, json.data);

        const remaining = parseInt(res.headers.get("x-ratelimit-remaining") ?? "1", 10);
        if (remaining === 0) {
            _setRateLimitPause(res.headers);
        }

        return json.data;

    } catch {
        return null;
    }
}

/* UTILITIES FOR DISCORD RESOLUTION */
function getDiscordUser(id) {
    return discordData?.[id] || discordData?.users?.[id] || null;
}

function getDiscordAvatar(user) {
    if (!user?.id) return "";
    if (user.avatar) {
        return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`;
    }
    return "https://cdn.discordapp.com/embed/avatars/0.png";
}