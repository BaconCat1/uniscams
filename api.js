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
const REQUEST_DELAY = 150; // delay between requests, attempted to dial in by hand
// 150ms ttl: 
// 300ms ttl: 110 sec

let rateLimitChain = Promise.resolve();

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

/* RATE LIMIT HANDLER — promise chain ensures strict serialization across all workers */
async function rateLimit() {
    const next = rateLimitChain.then(() => wait(REQUEST_DELAY));
    rateLimitChain = next;
    await next;
}

/* CRAFTY API CALLER — single attempt, queue handles retries */
async function fetchPlayer(uuid) {
    const cached = getCachedPlayer(uuid);
    if (cached) return cached;

    await rateLimit();

    try {
        const res = await fetch(`https://api.crafty.gg/api/v2/players/${uuid}`);

        if (res.status === 429) {
            await wait(1500); // brief pause before returning to queue
            return null;
        }

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const json = await res.json();
        if (!json?.data) throw new Error("Bad response");

        setCachedPlayer(uuid, json.data);
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