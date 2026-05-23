/* ========================================================
   UI & RENDERING LAYER (ui.js)
   ======================================================== */

// Initialize variables
let container;
let loadingScreen;
let loadingText;

/* HELPER: Ensure DOM elements are initialized */
function initUI() {
    if (!container) container = document.getElementById("players");
    if (!loadingScreen) loadingScreen = document.getElementById("loading-screen");
    if (!loadingText) loadingText = document.getElementById("loading-text");
}

/* UPDATE RETRY BANNER */
function showRetryBanner() {
    let el = document.getElementById("retry-banner");

    if (failedPlayers.size === 0) {
        if (el) el.remove();
        return;
    }

    if (!el) {
        el = document.createElement("div");
        el.id = "retry-banner";
        el.style = `
            position: fixed;
            left: 50%;
            bottom: 20px;
            transform: translate(-50%, 0);
            background: rgba(30,30,30,0.95);
            color: white;
            padding: 10px 16px;
            border-radius: 10px;
            cursor: pointer;
            z-index: 9999;
        `;
        // Bound to global handler in app.js
        el.onclick = retryFailedPlayers;
        document.body.appendChild(el);
    }

    el.innerText = `Retry ${failedPlayers.size} failed players`;
}

/* RENDER MAIN PLAYER CARDS AND TABS */
function renderPlayers() {
    initUI(); // Ensure elements are bound
    if (!container) return;

    container.innerHTML = "";

    for (const mainUuid of uuids) {
        const main = players.get(mainUuid);
        if (!main) continue;

        // CSS class is "player" per style.css — not "player-card"
        const card = document.createElement("div");
        card.className = "player";
        const head = `https://mc-heads.net/head/${mainUuid}.png`;

        // --- Username History ---
        const usernames = main.usernames || [];
        let usernameHistoryHTML = "";

        if (usernames.length) {
            usernameHistoryHTML = `
                <details class="section">
                    <summary>Username History (${usernames.length})</summary>
                    <div class="alt-entry">
                        ${usernames.map(entry => `
                            <div class="alt-row">
                                <div>${entry.username}</div>
                            </div>
                        `).join("")}
                    </div>
                </details>
            `;
        }

        // --- Linked Alts (from altMap) ---
        const alts = altMap[mainUuid] || [];
        let knownAltHTML = "";

        if (alts.length) {
            knownAltHTML = `
                <details class="section">
                    <summary>Alts (${alts.length})</summary>
                    <div class="alt-entry">
                        ${alts.map(altUuid => {
                            const altProfile = players.get(altUuid);
                            const altHead = `https://mc-heads.net/head/${altUuid}.png`;

                            if (!altProfile) {
                                return `<div class="alt-row"><span class="uuid">Loading: ${altUuid}</span></div>`;
                            }
                            return `
                                <div class="alt-row">
                                    <img src="${altHead}" width="24" height="24" style="border-radius:2px;">
                                    <div>
                                        <div>${altProfile.username}</div>
                                        <div class="uuid">${altProfile.uuid}</div>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </details>
            `;
        }

        // --- Manual Alts ---
        // Values are plain strings per data.json
        const manuals = manualAlts[mainUuid] || [];
        let manualAltHTML = "";

        if (manuals.length) {
            manualAltHTML = `
                <details class="section">
                    <summary>Manual Alts (${manuals.length})</summary>
                    <div class="alt-entry">
                        ${manuals.map(name => `
                            <div class="alt-row">${name}</div>
                        `).join("")}
                    </div>
                </details>
            `;
        }

        // --- Discord Accounts ---
        // Uses .discord-card / .discord-avatar / .discord-info / .discord-id per style.css
        const discordIds = discordLinks[mainUuid] || [];
        let discordHTML = "";

        if (discordIds.length) {
            discordHTML = `
                <details class="section">
                    <summary>Discord Accounts (${discordIds.length})</summary>
                    <div class="alt-entry">
                        ${discordIds.map(id => {
                            const dUser = getDiscordUser(id);
                            const avatar = dUser ? getDiscordAvatar(dUser) : "";
                            const displayName = dUser ? (dUser.global_name || dUser.username || id) : id;
                            const username = dUser?.username || "";
                            return `
                                <div class="discord-card">
                                    ${avatar
                                        ? `<img class="discord-avatar" src="${avatar}" width="40" height="40">`
                                        : `<div class="discord-avatar" style="width:40px;height:40px;background:#1e1f22;"></div>`
                                    }
                                    <div class="discord-info">
                                        <a href="https://discord.com/users/${id}" target="_blank">${displayName}${username && username !== displayName ? ` (@${username})` : ""}</a>
                                        <span class="discord-id">${id}</span>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </details>
            `;
        }

        card.innerHTML = `
            <div class="player-header">
                <img src="${head}" width="64" height="64" style="border-radius:4px;">
                <div>
                    <div class="username">${main.username}</div>
                    <div class="uuid">${main.uuid}</div>
                </div>
            </div>
            ${knownAltHTML}
            ${manualAltHTML}
            ${discordHTML}
            ${usernameHistoryHTML}
        `;
        container.appendChild(card);
    }
    renderUnlinkedPlayers();
}

/* RENDER UNLINKED/AMBIGUOUS SYSTEM HISTORICAL CARDS */
function renderUnlinkedPlayers() {
    initUI(); // Ensure elements are bound
    const unlinkedDataArray = window.unlinked || [];
    if (!container || !unlinkedDataArray.length) return;

    // ... (rest of your renderUnlinkedPlayers logic)
}
