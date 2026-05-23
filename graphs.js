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
    if (tooltip) tooltip.style.opacity = "0";
}

function renderStats() {
    const data = getStatsData();
    if (!data) return;

    // Pull the shared data exposed from app.js
    const playerMap = window.players || new Map();
    
    // Target the text container instead of destroying canvas mounting wrappers
    const textContainer = document.getElementById("statsText");
    if (textContainer) textContainer.innerHTML = "";

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

    statsBars.innerHTML = "<canvas id='canvasStats' width='500' height='290'></canvas>";

    const cStats = document.getElementById("canvasStats");
    const ctxStats = cStats.getContext("2d");

    const metrics = [
        {
            label: "Mains",
            val: absoluteScammers,
            color: "#e57373"
        },
        {
            label: "Alts",
            val: totalLinkedAlts,
            color: "#81c784"
        },
        {
            label: "Discords",
            val: discordCount,
            color: "#64b5f6"
        }
    ];

    let maxMetric = 0;
    metrics.forEach(m => {
        if (m.val > maxMetric) maxMetric = m.val;
    });

    ctxStats.fillStyle = "#ffffff";
    ctxStats.font = "14px Arial";
    ctxStats.fillText("Account Totals", 10, 25);

    const statsBarW = cStats.width / metrics.length;

    metrics.forEach((m, i) => {
        const h = (m.val / (maxMetric || 1)) * 200;
        const x = i * statsBarW + 40;
        const y = 240 - h;

        // Bar
        ctxStats.fillStyle = m.color;
        ctxStats.fillRect(x, y, statsBarW - 80, h);

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
        ctxStats.fillText(m.label, labelX, 270);
    });

    cStats.onmousemove = e => {
        const rect = cStats.getBoundingClientRect();
        const idx = Math.floor((e.clientX - rect.left) / statsBarW);
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
       SERVER DISTRIBUTION GRAPH
       ======================================================== */
    const serverBars = document.getElementById("serverBars");
    if (!serverBars) return;

    serverBars.innerHTML = "<canvas id='canvasServers' width='500' height='290'></canvas>";

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
        if (v > maxS) maxS = v;
    });

    ctxServers.fillStyle = "#ffffff";
    ctxServers.font = "14px Arial";
    ctxServers.fillText("Distribution Across Server Landscapes", 10, 25);

    const barW = cServers.width / (entries.length || 1);

    entries.forEach(([imgSrc, v], i) => {
        const h = (v / (maxS || 1)) * 200;
        const x = i * barW + 40;
        const y = 240 - h;

        ctxServers.fillStyle = "#2196F3";
        ctxServers.fillRect(x, y, barW - 80, h);

        ctxServers.fillStyle = "#FFFFFF";
        ctxServers.font = "14px Arial";
        ctxServers.textAlign = "center";

        ctxServers.fillText(
            v,
            x + (barW - 80) / 2,
            y - 8
        );

        const img = new Image();

        img.src = imgSrc;

        img.onload = () => {
            const imgX = x + (barW - 80) / 2 - 12;
            ctxServers.drawImage(img, imgX, 252, 24, 24);
        };
    });

    cServers.onmousemove = e => {
        const rect = cServers.getBoundingClientRect();
        const idx = Math.floor((e.clientX - rect.left) / barW);
        const e2 = entries[idx];

        if (!e2) return;

        showTip(
            `${names[e2[0]] || e2[0]}: ${e2[1]} Scammers Recorded`,
            e.clientX + 15,
            e.clientY + 15
        );
    };

    cServers.onmouseout = hideTip;
}