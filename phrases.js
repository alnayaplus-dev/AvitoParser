// phrases.js – генерация смежных n-грамм (топ-500)

function showPhrasesModal() {
    const existingModal = document.getElementById("voltparser-modal");
    if (existingModal) existingModal.remove();

    const modal = document.createElement("div");
    modal.id = "voltparser-modal";
    Object.assign(modal.style, {
        position: "fixed",
        top: "10%",
        left: "10%",
        width: "80%",
        maxWidth: "900px",
        height: "auto",
        maxHeight: "80%",
        background: "white",
        zIndex: "10000000000",
        borderRadius: "20px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif"
    });

    const header = document.createElement("div");
    header.style.cssText = "padding:15px 20px; background:#f5f5f5; border-bottom:1px solid #ddd; display:flex; justify-content:space-between; align-items:center;";
    header.innerHTML = `<h3 style="margin:0;">📈 Фразы (генерация смежных комбинаций)</h3><button id="closeModalBtn" style="background:none; border:none; font-size:20px; cursor:pointer;">✖</button>`;
    
    const content = document.createElement("div");
    content.style.cssText = "padding:20px; overflow-y:auto; flex:1;";
    
    const footer = document.createElement("div");
    footer.style.cssText = "padding:10px 20px; background:#f5f5f5; border-top:1px solid #ddd; text-align:right;";

    modal.appendChild(header);
    modal.appendChild(content);
    modal.appendChild(footer);
    document.body.appendChild(modal);

    document.getElementById("closeModalBtn").onclick = () => modal.remove();

    content.innerHTML = `
        <div style="margin-bottom:20px;">
            <label><strong>Исходные фразы (по одной на строку)</strong></label><br>
            <textarea id="phrasesTextarea" rows="8" style="width:100%; margin-top:5px; padding:8px; font-family:monospace;" placeholder="Введите фразы или загрузите CSV (первый столбец)"></textarea>
            <div style="margin-top:15px;">
                <button id="loadCsvBtn" class="p-modal-btn" style="background:#2196F3;">📂 Загрузить CSV (первый столбец)</button>
                <button id="generateCombosBtn" class="p-modal-btn" style="background:#4CAF50;">✨ Сгенерировать топ-500 смежных комбинаций</button>
                <button id="downloadCsvBtn" class="p-modal-btn" style="background:#ff8c00;">📥 Скачать CSV</button>
            </div>
            <div id="progressContainer" style="display:none; margin-top:10px;">
                <progress id="genProgress" value="0" max="100" style="width:100%; height:20px;"></progress>
                <div id="progressText" style="font-size:12px; color:#666;"></div>
            </div>
            <p style="font-size:12px; color:#666; margin-top:5px;">
                <strong>Правило:</strong> фраза разбивается на слова (разделители: пробел, /, -, _, знаки препинания), отбрасываются слова короче 4 символов. Из оставшихся создаются <strong>все смежные комбинации длиной от 2 до максимума</strong> (как скользящее окно). Результат – топ-500 самых частотных.
            </p>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        .p-modal-btn {
            padding: 8px 16px;
            border-radius: 40px;
            border: none;
            color: white;
            font-weight: 500;
            cursor: pointer;
            transition: 0.15s ease;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        .p-modal-btn:hover {
            transform: translateY(-1px);
            filter: brightness(0.95);
        }
    `;
    document.head.appendChild(style);

    const textarea = document.getElementById("phrasesTextarea");
    const progressContainer = document.getElementById("progressContainer");
    const progressBar = document.getElementById("genProgress");
    const progressText = document.getElementById("progressText");

    const MIN_WORD_LEN = 4;
    const TOP_N = 500;

    // Очистка: оставляем только буквы/цифры, но сначала заменяем разделители на пробелы, чтобы слова не склеивались
    function tokenizePhrase(phrase) {
        // Заменяем все символы, которые не являются буквами/цифрами, на пробел
        let cleaned = phrase.replace(/[^\p{L}\p{N}]/gu, ' ');
        // Разбиваем по пробелам, убираем пустые и слишком короткие
        return cleaned.split(/\s+/)
            .map(w => w.toLowerCase())
            .filter(w => w.length >= MIN_WORD_LEN);
    }

    // Генерация смежных n-грамм (все подстроки подряд длины от 2 до len(words))
    function generateNGrams(words) {
        const ngrams = [];
        for (let n = 2; n <= words.length; n++) {
            for (let i = 0; i <= words.length - n; i++) {
                const ngram = words.slice(i, i + n).join(' ');
                ngrams.push(ngram);
            }
        }
        return ngrams;
    }

    async function generateTopCombos(lines) {
        if (lines.length === 0) {
            alert("Нет фраз.");
            return false;
        }

        progressContainer.style.display = "block";
        progressBar.value = 0;
        progressText.innerText = "Генерация...";

        let freq = new Map();
        let totalSkipped = 0;

        for (let i = 0; i < lines.length; i++) {
            const words = tokenizePhrase(lines[i]);
            if (words.length < 2) {
                totalSkipped++;
                continue;
            }
            const ngrams = generateNGrams(words);
            for (let ng of ngrams) {
                freq.set(ng, (freq.get(ng) || 0) + 1);
            }
            progressBar.value = ((i+1)/lines.length)*100;
            progressText.innerText = `Обработано ${i+1}/${lines.length} фраз (найдено уникальных комбинаций: ${freq.size})`;
            await new Promise(r => setTimeout(r, 5));
        }

        if (freq.size === 0) {
            alert(`Не удалось сгенерировать комбинации. Убедитесь, что фразы содержат хотя бы два слова длиной >=${MIN_WORD_LEN} символов. Пропущено коротких фраз: ${totalSkipped}.`);
            progressContainer.style.display = "none";
            return false;
        }

        const sorted = Array.from(freq.entries()).sort((a,b) => b[1] - a[1]);
        const top = sorted.slice(0, TOP_N).map(item => item[0]);
        textarea.value = top.join("\n");
        progressContainer.style.display = "none";
        alert(`Сгенерировано ${freq.size} уникальных комбинаций. Показаны топ ${TOP_N}. Пропущено ${totalSkipped} фраз (менее 2 значимых слов).`);
        return true;
    }

    document.getElementById("generateCombosBtn").onclick = async () => {
        const lines = textarea.value.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) { alert("Нет исходных фраз."); return; }
        if (lines.length > 2000 && !confirm(`Слишком много фраз (${lines.length}). Может быть медленно. Продолжить?`)) return;
        await generateTopCombos(lines);
    };

    function parseFirstColumnFromCSV(csvText) {
        if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);
        const lines = csvText.split(/\r?\n/);
        if (lines.length === 0) return [];
        const delimiter = lines[0].includes(';') ? ';' : ',';
        const result = [];
        for (let i = 1; i < lines.length; i++) {
            let line = lines[i].trim();
            if (!line) continue;
            let firstCol = line.split(delimiter)[0];
            firstCol = firstCol.replace(/^"|"$/g, '').trim();
            if (firstCol) result.push(firstCol);
        }
        return result;
    }

    document.getElementById("loadCsvBtn").onclick = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv";
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const phrases = parseFirstColumnFromCSV(ev.target.result);
                if (phrases.length === 0) alert("Не найдено фраз в первом столбце CSV.");
                else textarea.value = phrases.join("\n");
            };
            reader.readAsText(file, "UTF-8");
        };
        input.click();
    };

    document.getElementById("downloadCsvBtn").onclick = () => {
        const lines = textarea.value.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length === 0) { alert("Нет фраз."); return; }
        let csv = "phrase\n";
        for (let line of lines) csv += `"${line.replace(/"/g, '""')}"\n`;
        downloadCSV(csv, "phrases.csv");
    };

    textarea.value = "";
}