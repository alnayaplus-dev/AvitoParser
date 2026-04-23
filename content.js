chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "togglePanel") {
        const panel = document.getElementById("avitoParserPanel");
        if (panel) {
            panel.remove();
        } else {
            createPanel();
        }
    }
});

// ===============================
// ОСНОВНАЯ ФУНКЦИЯ СОЗДАНИЯ ПАНЕЛИ
// ===============================
function createPanel() {
    if (document.getElementById("avitoParserPanel")) return;

    const panel = document.createElement("div");
    panel.id = "avitoParserPanel";

    Object.assign(panel.style, {
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: "9999999999",
        background: "#ffffff",
        padding: "12px 16px",
        borderRadius: "20px",
        boxShadow: "0 8px 20px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.05)",
        fontSize: "13px",
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        gap: "10px",
        alignItems: "center",
        border: "1px solid rgba(0,0,0,0.05)",
        transition: "all 0.2s ease"
    });

    panel.innerHTML = `
        <button id="mainBtn">📊 Статистика</button>
        <button id="analyticBtn">📈 Фразы</button>
        <button id="semanticBtn">🔍 Семантика</button>
        <button id="closePanel" style="background:#999;border-radius:40px;padding:6px 10px;color:white;border:none;cursor:pointer;">✖</button>
        <div id="status" style="margin:0; padding-left:8px; color:#666; font-size:12px; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
    `;

    document.body.appendChild(panel);

    const mainBtn = document.getElementById("mainBtn");
    const analyticBtn = document.getElementById("analyticBtn");
    const semanticBtn = document.getElementById("semanticBtn");
    const closeBtn = document.getElementById("closePanel");
    const status = document.getElementById("status");

    closeBtn.onclick = () => panel.remove();

    const styleBtn = (btn, bgColor, hoverColor) => {
        Object.assign(btn.style, {
            padding: "6px 14px",
            background: bgColor,
            color: "white",
            border: "none",
            borderRadius: "40px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: "500",
            transition: "all 0.15s ease",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            whiteSpace: "nowrap"
        });
        btn.addEventListener("mouseenter", () => {
            btn.style.background = hoverColor;
            btn.style.transform = "translateY(-1px)";
            btn.style.boxShadow = "0 4px 8px rgba(0,0,0,0.1)";
        });
        btn.addEventListener("mouseleave", () => {
            btn.style.background = bgColor;
            btn.style.transform = "translateY(0)";
            btn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
        });
    };

    styleBtn(mainBtn, "#4CAF50", "#45a049");
    styleBtn(analyticBtn, "#2196F3", "#0b7dda");
    styleBtn(semanticBtn, "#DC2780", "#c21e6f");

    let stopStats = false;
    let stopSemantic = false;
    let stopDemand = false;

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const getLinks = () => {
        return [...document.querySelectorAll("a[itemprop='url']")]
            .map(a => a.href)
            .filter((v, i, arr) => arr.indexOf(v) === i);
    };

    // ============================
    // СТАТИСТИКА
    // ============================
    mainBtn.onclick = async () => {
        if (mainBtn.dataset.mode === "stop") {
            stopStats = true;
            status.textContent = "⏹ Останавливаю...";
            return;
        }

        stopStats = false;
        mainBtn.dataset.mode = "stop";
        mainBtn.textContent = "⏹ Стоп";
        mainBtn.style.background = "#d9534f";

        const links = getLinks();
        let rows = [];

        for (let i = 0; i < links.length; i++) {
            if (stopStats) break;

            const url = links[i];

            try {
                const html = await fetch(url).then(r => r.text());
                const doc = new DOMParser().parseFromString(html, "text/html");

                const title = doc.querySelector("h1")?.innerText?.trim() || "";

                let description = "";
                const descEl =
                    doc.querySelector('[itemprop="description"]') ||
                    doc.querySelector("div[itemprop='description']") ||
                    doc.querySelector("[data-marker='item-description/text']") ||
                    doc.querySelector("[data-marker='item-description']");

                if (descEl) {
                    description = descEl.innerText
                        .replace(/\r/g, "")
                        .replace(/\n{2,}/g, "\n")
                        .replace(/[ \t]+/g, " ")
                        .trim();
                }

                if (!description) {
                    const scripts = doc.querySelectorAll("script");
                    scripts.forEach(s => {
                        if (s.innerText.includes("description")) {
                            const match = s.innerText.match(/"description":"(.*?)"/);
                            if (match) {
                                description = match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
                            }
                        }
                    });
                }

                let category = "";
                const match = url.match(/avito\.ru\/[^\/]+\/([^\/]+)/);
                if (match) category = match[1];

                const textAll = doc.body.innerText;
                const viewsTotal = textAll.match(/(\d[\d\s]*)\s+просмотр/)?.[1]?.replace(/\s/g, "") || "";
                const viewsToday = textAll.match(/\+?\s*(\d+)\s+сегодня/)?.[1] || "";

                let photos = [...doc.querySelectorAll("img")]
                    .map(img => img.src)
                    .filter(src => src.includes("images.avito") && !src.includes("50x50") && !src.includes("preview"));
                photos = [...new Set(photos)].slice(0, 10).join("|");

                rows.push({ title, description, viewsTotal, viewsToday, category, photos, url });

                status.textContent = `📄 ${i+1}/${links.length}`;
                await sleep(500);
            } catch (e) {
                console.log("Ошибка:", e);
            }
        }

        let csv = "title;description;views_total;views_today;category;photos;url\n";
        const safe = (v) => `"${(v || "").replace(/"/g, '""')}"`;
        rows.forEach(r => {
            csv += [safe(r.title), safe(r.description), safe(r.viewsTotal), safe(r.viewsToday), safe(r.category), safe(r.photos), safe(r.url)].join(";") + "\n";
        });

        downloadCSV(csv, "stats_full.csv");
        resetBtn(mainBtn, "📊 Статистика", "#4CAF50");
        status.textContent = "✅ Готово!";
    };

    // ============================
    // АНАЛИТИКА
    // ============================
    analyticBtn.onclick = async () => {
        if (analyticBtn.dataset.mode === "stop") {
            stopDemand = true;
            return;
        }

        stopDemand = false;
        analyticBtn.dataset.mode = "stop";
        analyticBtn.textContent = "⏹ Стоп";
        analyticBtn.style.background = "#d9534f";

        const links = getLinks();
        let titles = [];

        for (let i = 0; i < links.length; i++) {
            if (stopDemand) break;
            const html = await fetch(links[i]).then(r => r.text());
            const doc = new DOMParser().parseFromString(html, "text/html");
            const title = doc.querySelector("h1")?.innerText?.trim();
            if (!title) continue;
            titles.push(title);
            const parts = title.split(/[/|,-]/g).map(t => t.trim()).filter(t => t.length > 3);
            titles.push(...parts);
            status.textContent = `📈 ${i+1}/${links.length}`;
            await sleep(300);
        }

        titles = [...new Set(titles)];
        let csv = "phrase\n";
        titles.forEach(t => csv += `"${t.replace(/"/g, '""')}"\n`);
        downloadCSV(csv, "analytic.csv");
        resetBtn(analyticBtn, "📈 Фразы", "#2196F3");
        status.textContent = "✅ Готово!";
    };

    // ============================
    // СЕМАНТИКА
    // ============================
    semanticBtn.onclick = async () => {
        if (semanticBtn.dataset.mode === "stop") {
            stopSemantic = true;
            return;
        }

        stopSemantic = false;
        semanticBtn.dataset.mode = "stop";
        semanticBtn.textContent = "⏹ Стоп";
        semanticBtn.style.background = "#d9534f";

        const links = getLinks();
        let wordCount = {};

        for (let i = 0; i < links.length; i++) {
            if (stopSemantic) break;
            const html = await fetch(links[i]).then(r => r.text());
            const doc = new DOMParser().parseFromString(html, "text/html");
            const title = doc.querySelector("h1")?.innerText?.toLowerCase() || "";
            const words = title.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(w => w.length > 1);
            words.forEach(w => { wordCount[w] = (wordCount[w] || 0) + 1; });
            status.textContent = `🔍 ${i+1}/${links.length}`;
            await sleep(300);
        }

        let csv = "word;count\n";
        Object.entries(wordCount).sort((a,b) => b[1]-a[1]).forEach(([w,c]) => { csv += `${w};${c}\n`; });
        downloadCSV(csv, "semantic.csv");
        resetBtn(semanticBtn, "🔍 Семантика", "#DC2780");
        status.textContent = "✅ Готово!";
    };

    function downloadCSV(csv, filename) {
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function resetBtn(btn, text, color) {
        btn.dataset.mode = "";
        btn.textContent = text;
        btn.style.background = color;
    }
}
