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
    let maxAlts = 0;
    let absoluteScammers = data.uuids.length;

    Object.values(data.altMap).forEach(arr => {
        totalLinkedAlts += arr.length;
        if (arr.length > maxAlts) maxAlts = arr.length;
    });

    let discordCount = 0;
    Object.values(data.discordLinks).forEach(arr => discordCount += arr.length);

    // Build metrics report paragraph strings
    if (textContainer) {
        textContainer.innerHTML = `
            <p>• <strong>Total Verified Root Targets:</strong> ${absoluteScammers}</p>
            <p>• <strong>Total Linked Alt Profiles:</strong> ${totalLinkedAlts}</p>
            <p>• <strong>Max Linked Alts on Single Profile:</strong> ${maxAlts}</p>
            <p>• <strong>Associated Discord Footprints:</strong> ${discordCount}</p>
        `;
    }

    /* ========================================================
       CHART RENDERING MATRIX
       ======================================================== */
    const statsBars = document.getElementById("statsBars");
    if (!statsBars) return;
    statsBars.innerHTML = "<canvas id='canvasStats' width='500' height='260'></canvas>";

    const cStats = document.getElementById("canvasStats");
    const ctxStats = cStats.getContext("2d");

    ctxStats.fillStyle = "#ffffff";
    ctxStats.font = "14px Arial";
    ctxStats.fillText("Dataset Properties Matrix", 10, 25);

    const metrics = [
        { label: "Root Profiles", val: absoluteScammers, color: "#e57373" },
        { label: "System Alts", val: totalLinkedAlts, color: "#81c784" },
        { label: "Discord Handles", val: discordCount, color: "#64b5f6" }
    ];

    metrics.forEach((m, i) => {
        const y = 60 + i * 60;
        ctxStats.fillStyle = "#333333";
        ctxStats.fillRect(10, y, 480, 24);

        const fillW = Math.min(480, (m.val / (totalLinkedAlts || 10)) * 300 + 20);
        ctxStats.fillStyle = m.color;
        ctxStats.fillRect(10, y, fillW, 24);

        ctxStats.fillStyle = "#ffffff";
        ctxStats.font = "12px Arial";
        ctxStats.fillText(`${m.label} (${m.val})`, 20, y + 16);
    });

    // Server Specific Processing Data Bounds
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
        if (info.name) names[info.img] = info.name;
    });

    const entries = Object.entries(counts);
    let maxS = 0;
    entries.forEach(([_, v]) => { if (v > maxS) maxS = v; });

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
        ctxServers.fillText(v, x + (barW - 80) / 2, y - 8);

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

        showTip(`${names[e2[0]] || e2[0]}: ${e2[1]} Scammers Recorded`, e.clientX + 15, e.clientY + 15);
    };

    cServers.onmouseout = hideTip;
}