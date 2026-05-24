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
    initUI();

    if (!container) return;

    container.innerHTML = "";

    for (const mainUuid of uuids) {
        const main = players.get(mainUuid);

        if (!main) continue;

        const card = document.createElement("div");
        card.className = "player";

        const head = `https://mc-heads.net/head/${mainUuid}.png`;

        /* =========================
           SERVER BADGES
           ========================= */

        const serverTag = serverTags[mainUuid];

        let serverBadgeHTML = "";

        if (serverTag?.img) {
            serverBadgeHTML = `
                <a
                    href="${serverTag.link || "#"}"
                    target="_blank"
                    class="server-badge-link"
                >
                    <img
                        src="${serverTag.img}"
                        class="server-badge"
                        alt="Server Badge"
                    >
                </a>
            `;
        }

        /* =========================
           USERNAME HISTORY
           ========================= */

        const usernames = main.usernames || [];

        let usernameHistoryHTML = "";

        if (usernames.length) {
            usernameHistoryHTML = `
                <details class="section">
                    <summary>Username History (${usernames.length})</summary>

                    <div class="alt-entry">
                        ${usernames.map(entry => {

                            const raw =
                                entry.changed_at ??
                                entry.changedAt ??
                                entry.timestamp ??
                                entry.time ??
                                null;

                            let dateStr = "";

                            if (raw) {
                                const d = new Date(raw);

                                if (!isNaN(d)) {
                                    dateStr = d.toLocaleDateString(undefined, {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric"
                                    });
                                }
                            }

                            return `
                                <div
                                    class="alt-row"
                                    style="justify-content:space-between;"
                                >
                                    <div>${entry.username}</div>

                                    ${
                                        dateStr
                                            ? `<div class="uuid">${dateStr}</div>`
                                            : ""
                                    }
                                </div>
                            `;
                        }).join("")}
                    </div>
                </details>
            `;
        }

        /* =========================
           LINKED ALTS
           ========================= */

        const alts = altMap[mainUuid] || [];

        let knownAltHTML = "";

        if (alts.length) {
            knownAltHTML = `
                <details class="section">
                    <summary>Alts (${alts.length})</summary>

                    <div class="alt-entry">
                        ${alts.map(altUuid => {

                            const altProfile = players.get(altUuid);

                            const altHead =
                                `https://mc-heads.net/head/${altUuid}.png`;

                            if (!altProfile) {
                                return `
                                    <div class="alt-row">
                                        <span class="uuid">
                                            Loading: ${altUuid}
                                        </span>
                                    </div>
                                `;
                            }

                            return `
                                <div class="alt-row">
                                    <img
                                        src="${altHead}"
                                        width="24"
                                        height="24"
                                        style="border-radius:2px;"
                                    >

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

        /* =========================
           MANUAL ALTS
           ========================= */

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

        /* =========================
           DISCORD ACCOUNTS
           ========================= */

        const discordIds = discordLinks[mainUuid] || [];

        let discordHTML = "";

        if (discordIds.length) {
            discordHTML = `
                <details class="section">
                    <summary>Discord Accounts (${discordIds.length})</summary>

                    <div class="alt-entry">
                        ${discordIds.map(id => {

                            const dUser = getDiscordUser(id);

                            const avatar =
                                dUser ? getDiscordAvatar(dUser) : "";

                            const displayName = dUser
                                ? (dUser.global_name || dUser.username || id)
                                : id;

                            const username = dUser?.username || "";

                            return `
                                <div class="discord-card">

                                    ${
                                        avatar
                                            ? `
                                                <img
                                                    class="discord-avatar"
                                                    src="${avatar}"
                                                    width="40"
                                                    height="40"
                                                >
                                            `
                                            : `
                                                <div
                                                    class="discord-avatar"
                                                    style="
                                                        width:40px;
                                                        height:40px;
                                                        background:#1e1f22;
                                                    "
                                                ></div>
                                            `
                                    }

                                    <div class="discord-info">
                                        <a
                                            href="https://discord.com/users/${id}"
                                            target="_blank"
                                        >
                                            ${displayName}
                                            ${
                                                username &&
                                                username !== displayName
                                                    ? ` (@${username})`
                                                    : ""
                                            }
                                        </a>

                                        <span class="discord-id">${id}</span>
                                    </div>
                                </div>
                            `;
                        }).join("")}
                    </div>
                </details>
            `;
        }

        /* =========================
           CARD HTML
           ========================= */

        card.innerHTML = `
            <div class="player-header">

                <img
                    src="${head}"
                    width="64"
                    height="64"
                    style="border-radius:4px;"
                >

                <div style="flex:1;">
                    <div class="username">${main.username}</div>
                    <div class="uuid">${main.uuid}</div>
                </div>

                ${serverBadgeHTML}
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

/* ========================================================
   RENDER UNLINKED / AMBIGUOUS PROFILES
   ======================================================== */

function renderUnlinkedPlayers() {
    initUI();

    const unlinkedDataArray = window.unlinked || [];

    if (!container || !unlinkedDataArray.length) return;

    for (const entry of unlinkedDataArray) {

        const card = document.createElement("div");

        card.className = "player unlinked-profile";

        const displayName = entry.name || "Unknown Player";

        const discordId = entry.discordId;

        const note = entry.note || "";

        /* =========================
           TAGS / BADGES
           ========================= */

        const tags = entry.tags || [];

        let tagHTML = "";

        if (tags.length) {
            tagHTML = `
                <div
                    style="
                        display:flex;
                        gap:8px;
                        margin-top:10px;
                        flex-wrap:wrap;
                    "
                >
                    ${tags.map(tag => `
                        <a
                            href="${tag.link || "#"}"
                            target="_blank"
                            class="server-badge-link"
                        >
                            <img
                                src="${tag.img}"
                                class="server-badge"
                                alt="Tag Badge"
                            >
                        </a>
                    `).join("")}
                </div>
            `;
        }

        /* =========================
           DISCORD ACCOUNT
           ========================= */

        let discordHTML = "";

        if (discordId) {

            const dUser = getDiscordUser(discordId);

            const avatar =
                dUser ? getDiscordAvatar(dUser) : "";

            const globalName = dUser
                ? (dUser.global_name || dUser.username || discordId)
                : discordId;

            const username = dUser?.username || "";

            discordHTML = `
                <details class="section">
                    <summary>Discord Account</summary>

                    <div class="alt-entry">

                        <div class="discord-card">

                            ${
                                avatar
                                    ? `
                                        <img
                                            class="discord-avatar"
                                            src="${avatar}"
                                            width="40"
                                            height="40"
                                        >
                                    `
                                    : `
                                        <div
                                            class="discord-avatar"
                                            style="
                                                width:40px;
                                                height:40px;
                                                background:#1e1f22;
                                            "
                                        ></div>
                                    `
                            }

                            <div class="discord-info">

                                <a
                                    href="https://discord.com/users/${discordId}"
                                    target="_blank"
                                >
                                    ${globalName}
                                    ${
                                        username &&
                                        username !== globalName
                                            ? ` (@${username})`
                                            : ""
                                    }
                                </a>

                                <span class="discord-id">
                                    ${discordId}
                                </span>
                            </div>
                        </div>
                    </div>
                </details>
            `;
        }

        /* =========================
           METADATA
           ========================= */

        let metadataHTML = `
            <details class="section">
                <summary>Unlinked Metadata</summary>

                <div class="alt-entry">

                    ${
                        note
                            ? `
                                <div class="alt-row">
                                    <div>
                                        <div>Note</div>
                                        <div class="uuid">${note}</div>
                                    </div>
                                </div>
                            `
                            : ""
                    }

                </div>
            </details>
        `;

        /* =========================
           FINAL CARD
           ========================= */

        card.innerHTML = `
            <div class="player-header">

                <div
                    style="
                        width:64px;
                        height:64px;
                        border-radius:4px;
                        background:#1b1b1b;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-size:28px;
                    "
                >
                    ?
                </div>

                <div style="flex:1;">
                    <div class="username">${displayName}</div>

                    <div class="uuid">
                        No confirmed Minecraft main account
                    </div>

                    ${tagHTML}
                </div>
            </div>

            ${discordHTML}
            ${metadataHTML}
        `;

        container.appendChild(card);
    }
}