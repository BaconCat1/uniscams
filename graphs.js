/* ========================================================
   GRAPH RENDERING FOR STATS TAB (graphs.js)
   ======================================================== */

function getStatsData() {
    return window.statsData;
}

let tooltip;

/* TOOLTIP SETUP */
function showTip(text, x, y) {
    if (!tooltip) {
        tooltip = document.createElement("div");

        tooltip.style = `
            position: fixed;
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            pointer-events: none;
            z-index: 99999;
            transition: opacity 0.1s ease;
        `;

        document.body.appendChild(tooltip);
    }

    tooltip.innerText = text;
    tooltip.style.left = x + "px";
    tooltip.style.top = y + "px";
    tooltip.style.opacity = "1";
}

function hideTip() {
    if (tooltip) {
        tooltip.style.opacity = "0";
    }
}

function renderStats() {
    const data = getStatsData();

    if (!data) return;

    // Pull the shared data exposed from app.js
    const playerMap = window.players || new Map();

    // Target the text container instead of destroying canvas mounting wrappers
    const textContainer = document.getElementById("statsText");

    if (textContainer) {
        textContainer.innerHTML = "";
    }

    /* ========================================================
       DATA PARSING ENGINE
       ======================================================== */

    let totalLinkedAlts = 0;
    let absoluteScammers = data.uuids.length;

    // System detected alts
    Object.values(data.altMap).forEach(arr => {
        totalLinkedAlts += arr.length;
    });

    // Manual alts from data.json
    Object.values(data.manualAlts || {}).forEach(arr => {
        totalLinkedAlts += arr.length;
    });

    let discordCount = 0;

    Object.values(data.discordLinks).forEach(arr => {
        discordCount += arr.length;
    });

    // Build metrics report paragraph strings
    if (textContainer) {
        textContainer.innerHTML = `
            <p>• <strong>Mains:</strong> ${absoluteScammers}</p>
            <p>• <strong>Alts:</strong> ${totalLinkedAlts}</p>
            <p>• <strong>Discords:</strong> ${discordCount}</p>
        `;
    }

    /* ========================================================
       DATASET PROPERTIES BAR GRAPH
       ======================================================== */

    const statsBars = document.getElementById("statsBars");

    if (!statsBars) return;

    statsBars.innerHTML =
        "<canvas id='canvasStats' width='500' height='290'></canvas>";

    const cStats = document.getElementById("canvasStats");
    const ctxStats = cStats.getContext("2d");

    const metrics = [
        {
            label: "Mains",
            val: absoluteScammers
        },
        {
            label: "Alts",
            val: totalLinkedAlts
        },
        {
            label: "Discords",
            val: discordCount
        }
    ];

    let maxMetric = 0;

    metrics.forEach(m => {
        if (m.val > maxMetric) {
            maxMetric = m.val;
        }
    });

    const statsBarW = cStats.width / metrics.length;

    metrics.forEach((m, i) => {
        const h = (m.val / (maxMetric || 1)) * 170;

        const x = i * statsBarW + 40;
        const y = 240 - h;

        // Bar
        ctxStats.fillStyle = "#9C27B0";

        ctxStats.fillRect(
            x,
            y,
            statsBarW - 80,
            h
        );

        // Value text
        ctxStats.fillStyle = "#FFFFFF";
        ctxStats.font = "14px Arial";
        ctxStats.textAlign = "center";

        ctxStats.fillText(
            m.val,
            x + (statsBarW - 80) / 2,
            y - 8
        );

        // Label
        ctxStats.fillStyle = "#CCCCCC";
        ctxStats.font = "12px Arial";

        const labelX = x + (statsBarW - 80) / 2;

        ctxStats.fillText(
            m.label,
            labelX,
            270
        );
    });

    cStats.onmousemove = e => {
        const rect = cStats.getBoundingClientRect();

        const idx = Math.floor(
            (e.clientX - rect.left) / statsBarW
        );

        const metric = metrics[idx];

        if (!metric) return;

        showTip(
            `${metric.label}: ${metric.val}`,
            e.clientX + 15,
            e.clientY + 15
        );
    };

    cStats.onmouseout = hideTip;

    /* ========================================================
       USERNAME CHANGE GRAPH
       ======================================================== */

    const usernameBars = document.getElementById("usernameBars");

    if (usernameBars) {
        usernameBars.innerHTML =
            "<canvas id='canvasUsernames' width='500' height='290'></canvas>";

        const cUsernames = document.getElementById("canvasUsernames");
        const ctxUsernames = cUsernames.getContext("2d");

        const usernameMetrics = {
            "0": 0,
            "1": 0,
            "2": 0,
            "3+": 0
        };

        // playerMap is a Map(), not a normal object
        playerMap.forEach(player => {

            // CHANGE THIS FIELD IF NECESSARY
            const history =
                player.nameHistory ||
                player.usernameHistory ||
                player.names ||
                [];

            // History arrays usually include current username
            const changes = Math.max(0, history.length - 1);

            if (changes >= 3) {
                usernameMetrics["3+"]++;
            } else {
                usernameMetrics[String(changes)]++;
            }
        });

        const usernameEntries = Object.entries(usernameMetrics).map(
            ([label, val]) => ({
                label,
                val
            })
        );

        let maxUsernameMetric = 0;

        usernameEntries.forEach(entry => {
            if (entry.val > maxUsernameMetric) {
                maxUsernameMetric = entry.val;
            }
        });

        const usernameBarW =
            cUsernames.width / usernameEntries.length;

        usernameEntries.forEach((m, i) => {

            const h =
                (m.val / (maxUsernameMetric || 1)) * 170;

            const x = i * usernameBarW + 40;
            const y = 240 - h;

            // Bar
            ctxUsernames.fillStyle = "#FF9800";

            ctxUsernames.fillRect(
                x,
                y,
                usernameBarW - 80,
                h
            );

            // Value text
            ctxUsernames.fillStyle = "#FFFFFF";
            ctxUsernames.font = "14px Arial";
            ctxUsernames.textAlign = "center";

            ctxUsernames.fillText(
                m.val,
                x + (usernameBarW - 80) / 2,
                y - 8
            );

            // Label text
            ctxUsernames.fillStyle = "#CCCCCC";
            ctxUsernames.font = "12px Arial";

            ctxUsernames.fillText(
                `${m.label} changes`,
                x + (usernameBarW - 80) / 2,
                270
            );
        });

        cUsernames.onmousemove = e => {

            const rect =
                cUsernames.getBoundingClientRect();

            const idx = Math.floor(
                (e.clientX - rect.left) / usernameBarW
            );

            const metric = usernameEntries[idx];

            if (!metric) return;

            showTip(
                `${metric.label} changes: ${metric.val}`,
                e.clientX + 15,
                e.clientY + 15
            );
        };

        cUsernames.onmouseout = hideTip;
    }

    /* ========================================================
       SERVER DISTRIBUTION GRAPH
       ======================================================== */

    const serverBars = document.getElementById("serverBars");

    if (!serverBars) return;

    serverBars.innerHTML =
        "<canvas id='canvasServers' width='500' height='290'></canvas>";

    const cServers = document.getElementById("canvasServers");
    const ctxServers = cServers.getContext("2d");

    const counts = {};
    const names = {};

    Object.entries(data.serverTags).forEach(([uuid, info]) => {
        if (!info.img) return;

        counts[info.img] = (counts[info.img] || 0) + 1;

        if (info.name) {
            names[info.img] = info.name;
        }
    });

    const entries = Object.entries(counts);

    let maxS = 0;

    entries.forEach(([_, v]) => {
        if (v > maxS) {
            maxS = v;
        }
    });

    const padding = 40;
    const gap = 20;

    const usableWidth = cServers.width - padding * 2;

    const barW = Math.min(
        120,
        (usableWidth - (entries.length - 1) * gap) /
        (entries.length || 1)
    );

    entries.forEach(([imgSrc, v], i) => {
        const h = (v / (maxS || 1)) * 170;

        const x = padding + i * (barW + gap);
        const y = 240 - h;

        // Bar
        ctxServers.fillStyle = "#2196F3";

        ctxServers.fillRect(
            x,
            y,
            barW,
            h
        );

        // Value text
        ctxServers.fillStyle = "#FFFFFF";
        ctxServers.font = "14px Arial";
        ctxServers.textAlign = "center";

        ctxServers.fillText(
            v,
            x + barW / 2,
            y - 8
        );

        // Server icon
        const img = new Image();

        img.src = imgSrc;

        img.onload = () => {
            const imgX = x + barW / 2 - 12;

            ctxServers.drawImage(
                img,
                imgX,
                252,
                24,
                24
            );
        };
    });

    cServers.onmousemove = e => {
        const rect = cServers.getBoundingClientRect();

        const mouseX = e.clientX - rect.left - padding;

        const idx = Math.floor(
            mouseX / (barW + gap)
        );

        const e2 = entries[idx];

        if (!e2) return;

        showTip(
            `${e2[1]}`,
            e.clientX + 15,
            e.clientY + 15
        );
    };

    cServers.onmouseout = hideTip;
}