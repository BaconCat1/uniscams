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
    const retryCounts = new Map();
    const MAX_RETRIES = 3;
    const RATE_LIMITED = window._craftyRateLimited;

    const loadStart = performance.now();

    // 3 concurrent workers — parallel throughput without excessive bursting.
    // Each worker awaits the rate-limit pause *before dequeuing* so no request
    // is started while the window is closed. On a 429 (RATE_LIMITED sentinel)
    // the UUID is re-queued without burning a retry attempt.
    const workers = Array.from({ length: 3 }, async () => {
        while (queue.length) {
            // Wait out any active rate-limit window before touching the queue
            const pause = getRateLimitPause();
            if (pause) await pause;

            if (!queue.length) break;
            const uuid = queue.shift();
            const data = await fetchPlayer(uuid);

            if (data === RATE_LIMITED) {
                // Don't count this as a retry — just put it back
                queue.push(uuid);
                continue;
            }

            if (data) {
                players.set(uuid, data);
                loaded++;
            } else {
                const attempts = (retryCounts.get(uuid) || 0) + 1;
                if (attempts < MAX_RETRIES) {
                    retryCounts.set(uuid, attempts);
                    queue.push(uuid); // re-queue at the back, worker stays productive
                } else {
                    failedPlayers.add(uuid);
                    loaded++;
                }
            }

            // Global type evaluation wrapper to block ReferenceErrors
            if (typeof loadingText !== 'undefined' && loadingText) {
                loadingText.innerText = `Loading ${loaded}/${all.length}`;
            }

            renderPlayers();
            showRetryBanner();
        }
    });

    await Promise.all(workers);

    const loadMs = performance.now() - loadStart;
    const loadSec = (loadMs / 1000).toFixed(2);
    const success = all.length - failedPlayers.size;
    console.log(
        `[uniscams] loaded ${success}/${all.length} players in ${loadSec}s` +
        ` (${failedPlayers.size} failed)`
    );

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

    const RATE_LIMITED = window._craftyRateLimited;

    if (typeof loadingScreen !== 'undefined' && loadingScreen) {
        loadingScreen.style.display = "block";
    }

    const workers = Array.from({ length: 3 }, async () => {
        const retryCounts = new Map();
        const MAX_RETRIES = 3;
        while (queue.length) {
            const pause = getRateLimitPause();
            if (pause) await pause;

            if (!queue.length) break;
            const uuid = queue.shift();
            const data = await fetchPlayer(uuid);

            if (data === RATE_LIMITED) {
                queue.push(uuid);
                continue;
            }

            if (data) {
                players.set(uuid, data);
                loaded++;
            } else {
                const attempts = (retryCounts.get(uuid) || 0) + 1;
                if (attempts < MAX_RETRIES) {
                    retryCounts.set(uuid, attempts);
                    queue.push(uuid);
                } else {
                    failedPlayers.add(uuid);
                    loaded++;
                }
            }

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

/* SEARCH HIGHLIGHT ENGINE */
function highlightMatches(el, query) {

    // Remove any existing highlights and restore plain text nodes
    el.querySelectorAll("mark.search-highlight").forEach(mark => {
        mark.replaceWith(mark.textContent);
    });
    el.normalize();

    if (!query) return;

    // Walk only text nodes — skips attribute values, scripts, etc.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
        const text = node.textContent;
        const lower = text.toLowerCase();
        if (!lower.includes(query)) continue;

        const frag = document.createDocumentFragment();
        let last = 0;
        let idx;

        while ((idx = lower.indexOf(query, last)) !== -1) {
            if (idx > last) {
                frag.appendChild(document.createTextNode(text.slice(last, idx)));
            }
            const mark = document.createElement("mark");
            mark.className = "search-highlight";
            mark.textContent = text.slice(idx, idx + query.length);
            frag.appendChild(mark);
            last = idx + query.length;
        }

        if (last < text.length) {
            frag.appendChild(document.createTextNode(text.slice(last)));
        }

        node.replaceWith(frag);
    }
}

/* LIVE USER INTERACTION SEARCH ENGINE ARCHITECTURE */
function setupSearchFilter() {
    const searchInput = document.getElementById("player-search");
    if (!searchInput) return;

    searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();

        for (const mainUuid of uuids) {

            const card = container.querySelector(`[data-uuid="${mainUuid}"]`);

            if (!card) continue;

            /* =========================
               EMPTY SEARCH RESET
               ========================= */

            if (query === "") {

                card.style.display = "";
                highlightMatches(card, "");

                // Close all dropdowns when search cleared
                const details = card.querySelectorAll("details");

                details.forEach(detail => {
                    detail.open = false;
                });

                continue;
            }

            const main = players.get(mainUuid);

            if (!main) {
                card.style.display = "none";
                continue;
            }

            /* =========================
               MAIN PROFILE CHECKS
               ========================= */

            // 1. Root Profile Username Check
            const matchMainName =
                main.username?.toLowerCase().includes(query);

            // 2. Main UUID Match
            const matchMainUuid =
                main.uuid?.toLowerCase().includes(query);

            // 3. Username History Match
            const matchHistory =
                (main.usernames || []).some(h =>
                    h.username?.toLowerCase().includes(query)
                );

            /* =========================
               MANUAL ALT CHECKS
               ========================= */

            const manual = manualAlts[mainUuid] || [];

            const matchManual =
                manual.some(m =>
                    m.toLowerCase().includes(query)
                );

            /* =========================
               LINKED ALT CHECKS
               ========================= */

            const alts = altMap[mainUuid] || [];

            let matchKnownAlts = false;

            for (const altUuid of alts) {

                if (altUuid.toLowerCase().includes(query)) {
                    matchKnownAlts = true;
                    break;
                }

                const altProfile = players.get(altUuid);

                if (
                    altProfile &&
                    altProfile.username?.toLowerCase().includes(query)
                ) {
                    matchKnownAlts = true;
                    break;
                }
            }

            /* =========================
               DISCORD CHECKS
               ========================= */

            const discordIds = discordLinks[mainUuid] || [];

            let matchDiscord = false;

            for (const id of discordIds) {

                if (id.includes(query)) {
                    matchDiscord = true;
                    break;
                }

                const dUser = getDiscordUser(id);

                if (dUser) {

                    if (
                        dUser.username?.toLowerCase().includes(query) ||
                        dUser.global_name?.toLowerCase().includes(query)
                    ) {
                        matchDiscord = true;
                        break;
                    }
                }
            }

            /* =========================
               FINAL MATCH EVALUATION
               ========================= */

            const matches =
                matchMainName ||
                matchMainUuid ||
                matchHistory ||
                matchManual ||
                matchKnownAlts ||
                matchDiscord;

            card.style.display = matches ? "" : "none";
            if (matches) highlightMatches(card, query);

            /* =========================
               AUTO OPEN DROPDOWNS
               ========================= */

            const details = card.querySelectorAll("details");

            details.forEach(detail => {
                detail.open = matches;
            });
        }
    });

    // Retain focus when navigating back to list tab
    const tabsContainer = document.querySelector(".tabs");

    if (tabsContainer) {

        tabsContainer.addEventListener("click", () => {

            setTimeout(() => {

                const listTab = document.getElementById("tab-list");

                if (
                    listTab &&
                    listTab.classList.contains("active")
                ) {
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
