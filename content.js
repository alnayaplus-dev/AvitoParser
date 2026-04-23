// content.js — финальная версия
// Avito Parser: статистика, фразы, семантика с защитой от бана

chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === "togglePanel") {
        const panel = document.getElementById("avitoParserPanel");
        if (panel) panel.remove();
        else createPanel();
    }
});

// ============================================================
// ЗАЩИТА ОТ БАНА
// ============================================================
function randomSleep(min, max) {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));
}

async function fetchWithRetry(url, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url);
            if (response.status === 429) {
                const wait = 5000 * (attempt + 1) + Math.random() * 2000;
                await randomSleep(wait, wait + 2000);
                continue;
            }
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.text();
        } catch (e) {
            if (attempt === retries) throw e;
            const wait = 1000 * Math.pow(2, attempt) + Math.random() * 1000;
            await randomSleep(wait, wait + 1000);
        }
    }
}

function randomScroll() {
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const target = Math.random() * maxScroll;
    window.scrollTo({ top: target, behavior: 'smooth' });
    return randomSleep(300, 800);
}

// ============================================================
// СТОП-СЛОВА И ЧИСЛА ДЛЯ СЕМАНТИКИ
// ============================================================
const STOP_WORDS = new Set([
    'в', 'во', 'без', 'до', 'для', 'за', 'через', 'на', 'над', 'о', 'об', 'от', 'перед', 'под', 'при', 'про', 'с', 'со', 'у', 'из', 'из-за', 'из-под', 'к', 'по', 'благодаря', 'согласно', 'вопреки', 'ввиду', 'вследствие', 'наподобие',
    'и', 'а', 'но', 'да', 'или', 'либо', 'то', 'если', 'что', 'чтобы', 'потому', 'так', 'как', 'будто', 'словно', 'лишь', 'только', 'не', 'ни', 'нини',
    'бы', 'же', 'ли', 'не', 'ни', 'вот', 'вон', 'даже', 'уж', 'уже', 'только', 'почти', 'разве', 'неужели', 'ведь', 'все-таки', 'всего', 'всего-навсего',
    'я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они', 'меня', 'тебя', 'его', 'её', 'нас', 'вас', 'их', 'мне', 'тебе', 'ему', 'ей', 'нам', 'вам', 'им', 'себя',
    'мой', 'твой', 'его', 'её', 'наш', 'ваш', 'их', 'свой', 'этот', 'тот', 'такой', 'таков', 'столько', 'сколько', 'несколько', 'весь', 'всякий', 'каждый', 'любой', 'другой', 'иной', 'сам', 'самый',
    'это', 'эти', 'эта', 'этот', 'тех', 'те', 'там', 'тут', 'здесь', 'тогда', 'теперь', 'сейчас', 'уже', 'ещё',
    'продам', 'предлагаю', 'смотрите', 'новый', 'новое', 'новая', 'хороший', 'отличный', 'крутой'
]);

function isStopWord(word) {
    return STOP_WORDS.has(word.toLowerCase());
}

function isNumericWord(word) {
    return /^\d+$/.test(word);
}

// ============================================================
// УМНОЕ ИЗВЛЕЧЕНИЕ ФРАЗ (для кнопки "Фразы")
// ============================================================
function extractPhrases(title) {
    if (!title || title.length < 3) return [];

    const commaSplit = title.split(',');
    if (commaSplit.length >= 3) {
        let common = commaSplit[0].trim();
        const commonWords = common.split(/\s+/);
        if (commonWords.length >= 2 && 
            !/^(в|на|с|по|без|для|у|к|и|а|но|или)$/i.test(commonWords[commonWords.length-1]) && 
            !/^\d+$/.test(commonWords[commonWords.length-1])) {
            const items = commaSplit.slice(1).map(s => s.trim()).filter(s => s.length > 0);
            if (items.length > 0) {
                const result = [];
                result.push(title);
                result.push(common);
                for (let item of items) {
                    const combined = common + ' ' + item;
                    if (combined !== title && !result.includes(combined)) {
                        result.push(combined);
                    }
                }
                return [...new Map(result.map(r => [r, r])).values()];
            }
        }
    }
    return [title];
}

// ============================================================
// СОЗДАНИЕ ПАНЕЛИ УПРАВЛЕНИЯ
// ============================================================
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
    styleBtn(analyticBtn, "#2196F3", "#0b7dda");
    styleBtn(semanticBtn, "#DC2780", "#c21e6f");

    let stopStats = false, stopSemantic = false, stopDemand = false;

    const getLinks = () => {
        return [...document.querySelectorAll("a[itemprop='url']")]
            .map(a => a.href)
            .filter((v, i, arr) => arr.indexOf(v) === i);
    };

    // ============================================================
    // 1. СТАТИСТИКА
    // ============================================================
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

    // ============================================================
    // 2. ФРАЗЫ (умное извлечение)
    // ============================================================
    analyticBtn.onclick = async () => {
        if (analyticBtn.dataset.mode === "stop") {
            stopDemand = true;
            return;
        }
        stopDemand = false;
        analyticBtn.dataset.mode = "stop";
        analyticBtn.textContent = "⏹ Стоп";
        analyticBtn.style.background = "#d9534f";

        await randomSleep(1000, 3000);
        await randomScroll();

        const links = getLinks();
        if (links.length === 0) {
            status.textContent = "❌ Нет ссылок";
            resetBtn(analyticBtn, "📈 Фразы", "#2196F3");
            return;
        }

        let allPhrases = [];
        for (let i = 0; i < links.length; i++) {
            if (stopDemand) break;
            status.textContent = `📈 ${i+1}/${links.length}`;
            await randomSleep(1200, 3500);
            if (i > 0 && i % 5 === 0) {
                status.textContent = `😴 Пауза...`;
                await randomSleep(7000, 13000);
                await randomScroll();
            }
            try {
                const html = await fetchWithRetry(links[i]);
                const doc = new DOMParser().parseFromString(html, "text/html");
                const title = doc.querySelector("h1")?.innerText?.trim();
                if (!title) continue;
                const phrasesFromTitle = extractPhrases(title);
                allPhrases.push(...phrasesFromTitle);
                await randomSleep(300, 800);
            } catch(e) { console.error(e); await randomSleep(2000, 4000); }
        }

        const unique = [...new Set(allPhrases)];
        let csv = "phrase\n";
        unique.forEach(p => csv += `"${p.replace(/"/g, '""')}"\n`);
        downloadCSV(csv, "analytic_phrases.csv");
        resetBtn(analyticBtn, "📈 Фразы", "#2196F3");
        status.textContent = `✅ Готово! ${unique.length} фраз.`;
    };

    // ============================================================
    // 3. СЕМАНТИКА
    // ============================================================
    semanticBtn.onclick = async () => {
        if (semanticBtn.dataset.mode === "stop") {
            stopSemantic = true;
            return;
        }
        stopSemantic = false;
        semanticBtn.dataset.mode = "stop";
        semanticBtn.textContent = "⏹ Стоп";
        semanticBtn.style.background = "#d9534f";

        await randomSleep(1000, 3000);
        await randomScroll();

        const links = getLinks();
        if (links.length === 0) {
            status.textContent = "❌ Нет ссылок";
            resetBtn(semanticBtn, "🔍 Семантика", "#DC2780");
            return;
        }

        let wordCount = {};
        for (let i = 0; i < links.length; i++) {
            if (stopSemantic) break;
            status.textContent = `🔍 ${i+1}/${links.length}`;
            await randomSleep(1200, 3500);
            if (i > 0 && i % 7 === 0) {
                status.textContent = `😴 Пауза...`;
                await randomSleep(8000, 14000);
                await randomScroll();
            }
            try {
                const html = await fetchWithRetry(links[i]);
                const doc = new DOMParser().parseFromString(html, "text/html");
                const title = doc.querySelector("h1")?.innerText?.toLowerCase() || "";
                const words = title.replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(w => w.length > 1);
                for (let w of words) {
                    if (!isStopWord(w) && !isNumericWord(w)) {
                        wordCount[w] = (wordCount[w] || 0) + 1;
                    }
                }
                await randomSleep(200, 600);
            } catch(e) { console.error(e); await randomSleep(2000, 5000); }
        }

        let csv = "word;count\n";
        Object.entries(wordCount).sort((a,b) => b[1]-a[1]).forEach(([w,c]) => { csv += `${w};${c}\n`; });
        downloadCSV(csv, "semantic_words.csv");
        resetBtn(semanticBtn, "🔍 Семантика", "#DC2780");
        status.textContent = `✅ Готово! ${Object.keys(wordCount).length} слов (без стоп-слов и чисел).`;
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