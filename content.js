chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "togglePanel") {
        const panel = document.getElementById("avitoParserPanel");
        if (panel) panel.remove();
        else createPanel();
    }
});

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
        flexWrap: "wrap",
    });

    panel.innerHTML = `
        <button id="mainBtn">📊 Статистика</button>
        <button id="phrasesBtn">📈 Фразы</button>
        <button id="semanticBtn">🔍 Семантика</button>
        <button id="closePanel" style="background:#999;border-radius:40px;padding:6px 10px;color:white;border:none;cursor:pointer;">✖</button>
        <div id="status" style="margin:0; padding-left:8px; color:#666; font-size:12px; max-width:180px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;"></div>
    `;

    document.body.appendChild(panel);

    const mainBtn = document.getElementById("mainBtn");
    const phrasesBtn = document.getElementById("phrasesBtn");
    const semanticBtn = document.getElementById("semanticBtn");
    const closeBtn = document.getElementById("closePanel");
    const status = document.getElementById("status");

    closeBtn.onclick = () => panel.remove();
    phrasesBtn.onclick = () => showPhrasesModal();

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
            whiteSpace: "nowrap"
        });
        btn.addEventListener("mouseenter", () => {
            btn.style.background = hoverColor;
            btn.style.transform = "translateY(-1px)";
        });
        btn.addEventListener("mouseleave", () => {
            btn.style.background = bgColor;
            btn.style.transform = "translateY(0)";
        });
    };

    styleBtn(mainBtn, "#4CAF50", "#45a049");
    styleBtn(phrasesBtn, "#2196F3", "#0b7dda");
    styleBtn(semanticBtn, "#DC2780", "#c21e6f");

    let stopStats = false;
    let stopSemanticFlag = { value: false };

    const getLinks = () => {
        return [...document.querySelectorAll("a[itemprop='url']")]
            .map(a => a.href)
            .filter((v, i, arr) => arr.indexOf(v) === i);
    };

    // СТАТИСТИКА
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

        await randomSleep(1000, 3000);
        await randomScroll();

        const links = getLinks();
        if (links.length === 0) {
            status.textContent = "❌ Нет ссылок на странице";
            resetBtn(mainBtn, "📊 Статистика", "#4CAF50");
            return;
        }

        let rows = [];
        for (let i = 0; i < links.length; i++) {
            if (stopStats) break;
            const url = links[i];
            status.textContent = `📄 ${i+1}/${links.length}`;
            await randomSleep(1000, 4000);
            if (i > 0 && i % 5 === 0) {
                status.textContent = `😴 Пауза...`;
                await randomSleep(6000, 12000);
                await randomScroll();
            }

            try {
                const html = await fetchWithRetry(url);
                const doc = new DOMParser().parseFromString(html, "text/html");
                const title = doc.querySelector("h1")?.innerText?.trim() || "";
                let description = "";
                const descEl = doc.querySelector('[itemprop="description"]') ||
                               doc.querySelector("div[itemprop='description']") ||
                               doc.querySelector("[data-marker='item-description/text']") ||
                               doc.querySelector("[data-marker='item-description']");
                if (descEl) {
                    description = descEl.innerText.replace(/\r/g, "").replace(/\n{2,}/g, "\n").replace(/[ \t]+/g, " ").trim();
                }
                if (!description) {
                    const scripts = doc.querySelectorAll("script");
                    for (let s of scripts) {
                        if (s.innerText.includes("description")) {
                            const match = s.innerText.match(/"description":"(.*?)"/);
                            if (match) {
                                description = match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
                                break;
                            }
                        }
                    }
                }
                let category = "";
                const match = url.match(/avito\.ru\/[^\/]+\/([^\/]+)/);
                if (match) category = match[1];
                const textAll = doc.body.innerText;
                const viewsTotal = textAll.match(/(\d[\d\s]*)\s+просмотр/)?.[1]?.replace(/\s/g, "") || "";
                const viewsToday = textAll.match(/\+?\s*(\d+)\s+сегодня/)?.[1] || "";

                rows.push({ title, description, viewsTotal, viewsToday, category, url });
                await randomSleep(200, 800);
            } catch (e) {
                console.error(e);
                await randomSleep(3000, 6000);
            }
        }

        let csv = "title;description;views_total;views_today;category;url\n";
        const safe = (v) => `"${(v || "").replace(/"/g, '""')}"`;
        rows.forEach(r => {
            csv += [safe(r.title), safe(r.description), safe(r.viewsTotal), safe(r.viewsToday), safe(r.category), safe(r.url)].join(";") + "\n";
        });
        downloadCSV(csv, "stats_full.csv");
        resetBtn(mainBtn, "📊 Статистика", "#4CAF50");
        status.textContent = `✅ Готово! Собрано ${rows.length} записей.`;
        stopStats = false;
    };

    // СЕМАНТИКА
    semanticBtn.onclick = async () => {
        if (semanticBtn.dataset.mode === "stop") {
            stopSemanticFlag.value = true;
            status.textContent = "⏹ Останавливаю...";
            return;
        }
        stopSemanticFlag.value = false;
        semanticBtn.dataset.mode = "stop";
        semanticBtn.textContent = "⏹ Стоп";
        semanticBtn.style.background = "#d9534f";

        await window.runSemanticParsing(status, stopSemanticFlag, getLinks);

        resetBtn(semanticBtn, "🔍 Семантика", "#DC2780");
    };

    function resetBtn(btn, text, color) {
        btn.dataset.mode = "";
        btn.textContent = text;
        btn.style.background = color;
    }
}