require("dotenv").config();

const fs = require("fs");

// =====================
// CONFIG
// =====================
const DATA_FILE = "./data.json";
const OUTPUT_FILE = "./discord.json";

// =====================
// CACHE
// =====================
const cache = new Map();

function getCache(id) {
    return cache.get(id) || null;
}

function setCache(id, data) {
    cache.set(id, data);
}

// =====================
// UTILS
// =====================
const sleep = (ms) =>
    new Promise(r => setTimeout(r, ms));

const jitter = (ms) =>
    Math.floor(ms * (0.7 + Math.random() * 0.6));

// =====================
// DISCORD FETCH
// =====================
async function fetchDiscordUser(id, attempt = 0) {

    const cached = getCache(id);

    if (cached) {
        return cached;
    }

    try {

        // small random delay
        await sleep(jitter(120));

        const res = await fetch(
            `https://discord.com/api/v10/users/${id}`,
            {
                headers: {
                    Authorization:
                        `Bot ${process.env.DISCORD_BOT_TOKEN}`
                }
            }
        );

        // =====================
        // RATE LIMIT
        // =====================
        if (res.status === 429) {

            const retryAfter =
                res.headers.get("retry-after");

            const waitMs = retryAfter
                ? Number(retryAfter) * 1000
                : 2000;

            console.log(
                `[RATE LIMIT ${id}] waiting ${waitMs}ms`
            );

            await sleep(waitMs);

            if (attempt < 3) {
                return fetchDiscordUser(
                    id,
                    attempt + 1
                );
            }

            return null;
        }

        if (!res.ok) {

            console.log(
                `[FAIL ${id}] ${res.status}`
            );

            return null;
        }

        const data = await res.json();

        const cleaned = {
            id: data.id,
            username: data.username,
            global_name: data.global_name,
            avatar: data.avatar
        };

        setCache(id, cleaned);

        console.log(
            `[OK] ${cleaned.username} (${id})`
        );

        return cleaned;

    } catch (e) {

        console.log(
            `[ERROR ${id}]`,
            e.message
        );

        if (attempt < 2) {

            await sleep(1000);

            return fetchDiscordUser(
                id,
                attempt + 1
            );
        }

        return null;
    }
}

// =====================
// LOAD IDS
// =====================
function getAllDiscordIds() {

    const raw =
        fs.readFileSync(DATA_FILE, "utf8");

    const data = JSON.parse(raw);

    const ids = new Set();

    // =====================
    // NORMAL LINKED USERS
    // =====================
    for (
        const arr of Object.values(
            data.discordLinks || {}
        )
    ) {

        if (!Array.isArray(arr)) {
            continue;
        }

        for (const id of arr) {

            if (id) {
                ids.add(id);
            }
        }
    }

    // =====================
    // UNLINKED PLAYERS
    // =====================
    for (
        const player of (
            data.unlinked || []
        )
    ) {

        if (!player) {
            continue;
        }

        // supports:
        // { discord: "123" }
        // { discordId: "123" }
        // { discordIds: ["123"] }
        // { discordLinks: ["123"] }

        if (player.discord) {
            ids.add(player.discord);
        }

        if (player.discordId) {
            ids.add(player.discordId);
        }

        if (
            Array.isArray(player.discordIds)
        ) {

            for (const id of player.discordIds) {

                if (id) {
                    ids.add(id);
                }
            }
        }

        if (
            Array.isArray(player.discordLinks)
        ) {

            for (const id of player.discordLinks) {

                if (id) {
                    ids.add(id);
                }
            }
        }
    }

    return [...ids];
}

// =====================
// COUNT IDS
// =====================
function countDiscordIds() {

    const ids = getAllDiscordIds();

    console.log(`
[COUNT]
Unique Discord IDs: ${ids.length}
`);

    return ids.length;
}

// =====================
// CONCURRENCY LIMITER
// =====================
async function runPool(
    items,
    limit,
    fn
) {

    const results = [];

    let index = 0;

    async function worker() {

        while (index < items.length) {

            const i = index++;

            results[i] =
                await fn(items[i]);
        }
    }

    const workers = Array.from(
        { length: limit },
        worker
    );

    await Promise.all(workers);

    return results;
}

// =====================
// EXPORT
// =====================
async function exportDiscord() {

    console.log(
        "[EXPORT] Starting discord.json generation"
    );

    const ids = getAllDiscordIds();

    console.log(
        `[EXPORT] ${ids.length} unique IDs`
    );

    const results = await runPool(
        ids,
        3,
        async (id) => {

            const user =
                await fetchDiscordUser(id);

            if (!user) {
                return null;
            }

            return [id, user];
        }
    );

    const output = {};

    for (const entry of results) {

        if (!entry) continue;

        const [id, user] = entry;

        output[id] = user;
    }

    fs.writeFileSync(
        OUTPUT_FILE,
        JSON.stringify(output, null, 2)
    );

    console.log(
        `[EXPORT] Wrote ${Object.keys(output).length} users to ${OUTPUT_FILE}`
    );
}

// =====================
// CLI
// =====================
async function main() {

    const args = process.argv.slice(2);

    if (args.includes("--export-discord")) {

        await exportDiscord();

        return;
    }

    if (args.includes("--count-discord")) {

        countDiscordIds();

        return;
    }

    console.log(`
Usage:

node discord_uid.js --export-discord
node discord_uid.js --count-discord
`);
}

main();