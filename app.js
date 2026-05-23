/* ========================================================
   APPLICATION ORCHESTRATOR (app.js)
   ======================================================== */

/* BOOTSTRAP PIPELINE */
async function loadPlayers() {
    await loadConfig();

    // Convert alt -> main  INTO  main -> [alts]
    const normalizedAltMap = {};

    for (const [altUuid, mainUuid] of Object.entries(altMap)) {
        if (!normalizedAltMap[mainUuid]) {
            normalizedAltMap[mainUuid] = [];
        }
        normalizedAltMap[mainUuid].push(altUuid);
    }

    altMap = normalizedAltMap;
    await loadDiscordData();

    // Expose unlinked globally right away for ui.js scope mapping security
    window.unlinked = unlinked || [];

    // Deduplicate profiles to determine total distinct profiles needed.
    // After inversion, alt UUIDs live in altMap VALUES not keys — flatten them.
    const allAltUuids = Object.values(altMap).flat();
    const all = [...new Set([...uuids, ...allAltUuids])];

    let loaded = 0;
    const queue = [...all];

    // Fire asynchronous worker threads concurrently
    const workers = Array.from({ length: 3 }, async () => {
        while (queue.length) {
            const uuid = queue.shift();
            const data = await fetchPlayer(uuid);

            if (data) players.set(uuid, data);
            else failedPlayers.add(uuid);

            loaded++;

            // Global type evaluation wrapper to block ReferenceErrors
            if (typeof loadingText !== 'undefined' && loadingText) {
                loadingText.innerText = `Loading ${loaded}/${all.length}`;
            }

            renderPlayers();
            showRetryBanner();
        }
    });

    await Promise.all(workers);

    renderPlayers();
    showRetryBanner();

    if (typeof loadingScreen !== 'undefined' && loadingScreen) {
        loadingScreen.style.display = "none";
    }

    // Expose local arrays globally for window scope binding compatibility (graphs.js integration)
    window.players = players;
    window.statsData = {
        uuids: uuids,
        altMap: altMap,
        manualAlts: manualAlts,
        discordLinks: discordLinks,
        serverTags: serverTags
    };

    if (window.renderStats) window.renderStats();

    // Initialize Global Interactive Live Input Filter Search Engine
    setupSearchFilter();
}

/* RETRY PIPELINE LINKED TO RETRY BANNER */
async function retryFailedPlayers() {
    if (failedPlayers.size === 0) return;

    const queue = [...failedPlayers];
    failedPlayers.clear();

    // Mirror the same alt UUID count logic from loadPlayers
    const allAltUuids = Object.values(altMap).flat();
    const allCount = [...new Set([...uuids, ...allAltUuids])].length;
    let loaded = allCount - queue.length;

    if (typeof loadingScreen !== 'undefined' && loadingScreen) {
        loadingScreen.style.display = "block";
    }

    const workers = Array.from({ length: 3 }, async () => {
        while (queue.length) {
            const uuid = queue.shift();
            const data = await fetchPlayer(uuid);

            if (data) players.set(uuid, data);
            else failedPlayers.add(uuid);

            loaded++;
            if (typeof loadingText !== 'undefined' && loadingText) {
                loadingText.innerText = `Retrying ${loaded}/${allCount}`;
            }
            renderPlayers();
            showRetryBanner();
        }
    });

    await Promise.all(workers);

    if (typeof loadingScreen !== 'undefined' && loadingScreen) {
        loadingScreen.style.display = "none";
    }
    if (window.renderStats) window.renderStats();
}

/* LIVE USER INTERACTION SEARCH ENGINE ARCHITECTURE */
function setupSearchFilter() {
    const searchInput = document.getElementById("player-search");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        // Cards use class "player" per style.css
        const cards = container.getElementsByClassName("player");

        // Loop cards array to verify parameters against users
        let index = 0;
        for (const mainUuid of uuids) {
            const card = cards[index++];
            if (!card) continue;

            if (query === "") {
                card.style.display = "";
                continue;
            }

            const main = players.get(mainUuid);
            if (!main) {
                card.style.display = "none";
                continue;
            }

            // 1. Root Profile Username Check
            const matchMainName = main.username?.toLowerCase().includes(query);

            // 2. Main Account Hardware UUID String Match Check
            const matchMainUuid = main.uuid?.toLowerCase().includes(query);

            // 3. Historical Text Log Name Checks
            const matchHistory = (main.usernames || []).some(h => h.username?.toLowerCase().includes(query));

            // 4. Manual Configuration Alts Text Tag Check
            // manualAlts values are plain strings, not objects
            const manual = manualAlts[mainUuid] || [];
            const matchManual = manual.some(m => m.toLowerCase().includes(query));

            // 5. Linked Active System Alts Profiles Check
            const alts = altMap[mainUuid] || [];
            let matchKnownAlts = false;
            for (const altUuid of alts) {
                if (altUuid.toLowerCase().includes(query)) {
                    matchKnownAlts = true;
                    break;
                }
                const altProfile = players.get(altUuid);
                if (altProfile && altProfile.username?.toLowerCase().includes(query)) {
                    matchKnownAlts = true;
                    break;
                }
            }

            // 6. Discord Accounts Snowflake IDs and Display Names Matching
            const discordIds = discordLinks[mainUuid] || [];
            let matchDiscord = false;
            for (const id of discordIds) {
                if (id.includes(query)) {
                    matchDiscord = true;
                    break;
                }
                const dUser = getDiscordUser(id);
                if (dUser) {
                    if (dUser.username?.toLowerCase().includes(query) || dUser.global_name?.toLowerCase().includes(query)) {
                        matchDiscord = true;
                        break;
                    }
                }
            }

            if (matchMainName || matchMainUuid || matchHistory || matchManual || matchKnownAlts || matchDiscord) {
                card.style.display = "";
            } else {
                card.style.display = "none";
            }
        }
    });

    // Retain focus when navigating back to list tab
    const tabsContainer = document.querySelector(".tabs");
    if (tabsContainer) {
        tabsContainer.addEventListener("click", () => {
            setTimeout(() => {
                const listTab = document.getElementById("tab-list");
                if (listTab && listTab.classList.contains("active")) {
                    searchInput.focus();
                }
            }, 50);
        });
    }
}

/* LIFE-CYCLE REFRESH LISTENERS */
window.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("clear-cache-btn");
    if (btn) {
        btn.addEventListener("click", () => {
            // Clears LocalStorage caching pipeline setup in api.js
            localStorage.clear();
            location.reload();
        });
    }

    // Kickstart application engine load sequence
    loadPlayers();
});
