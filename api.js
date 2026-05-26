/* ========================================================
   API & DATA LAYER (api.js)
   ======================================================== */
let uuids = [];
let altMap = {};
let manualAlts = {};
let discordLinks = {};
let serverTags = {};
let discordData = {};
let unlinked = [];

const players = new Map();
const failedPlayers = new Set();

const PLAYER_TTL = 1000 * 60 * 60 * 6; // 6 Hours cache TTL

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
    discordData = res.ok ? await res.json() : {};
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

/* RATE LIMIT PAUSE — shared across all workers.
   When a 429 fires (or remaining hits 0), this is set to a promise
   that resolves after the Retry-After / x-ratelimit-reset duration.
   Workers await getRateLimitPause() *before dequeuing* each UUID so
   no request is even started while the window is exhausted. */
let rateLimitPause = null;

/* Sentinel returned by fetchPlayer on a 429 so the worker can re-queue
   the UUID without burning a retry attempt. */
const RATE_LIMITED = Symbol("RATE_LIMITED");
window._craftyRateLimited = RATE_LIMITED; // expose for app.js worker loop

function _setRateLimitPause(headers) {
    if (rateLimitPause) return; // already waiting — don't clobber
    const reset  = headers && headers.get("x-ratelimit-reset");
    const waitMs = reset
        ? Math.max(0, new Date(reset).getTime() - Date.now())
        : parseInt((headers && headers.get("retry-after")) || "10", 10) * 1000;
    console.log(`[uniscams] rate-limit pause ${(waitMs / 1000).toFixed(1)}s`);
    rateLimitPause = wait(waitMs).then(() => { rateLimitPause = null; });
}

/* Workers call this before dequeuing to avoid firing into a closed window */
function getRateLimitPause() { return rateLimitPause; }

/* CRAFTY API CALLER — proactively reads rate-limit headers */
async function fetchPlayer(uuid) {
    const cached = getCachedPlayer(uuid);
    if (cached) return cached;

    // Belt-and-suspenders guard; workers should already be awaiting the pause
    if (rateLimitPause) await rateLimitPause;

    try {
        const res = await fetch(`https://api.crafty.gg/api/v2/players/${uuid}`);

        if (res.status === 429) {
            _setRateLimitPause(res.headers);
            return RATE_LIMITED; // worker re-queues without burning a retry
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!json?.data) throw new Error("Bad response");

        setCachedPlayer(uuid, json.data);

        // Proactively pause when quota exhausted so the next dequeue
        // doesn't immediately 429.
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
