// Общие утилиты для всех модулей

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

function downloadCSV(csv, filename) {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const STOP_WORDS = new Set([
    'в', 'во', 'без', 'до', 'для', 'за', 'через', 'на', 'над', 'о', 'об', 'от', 'перед', 'под', 'при', 'про', 'с', 'со', 'у', 'из', 'из-за', 'из-под', 'к', 'по', 'благодаря', 'согласно', 'вопреки', 'ввиду', 'вследствие', 'наподобие',
    'и', 'а', 'но', 'да', 'или', 'либо', 'то', 'если', 'что', 'чтобы', 'потому', 'так', 'как', 'будто', 'словно', 'лишь', 'только', 'не', 'ни', 'нини',
    'бы', 'же', 'ли', 'не', 'ни', 'вот', 'вон', 'даже', 'уж', 'уже', 'только', 'почти', 'разве', 'неужели', 'ведь', 'все-таки',
    'я', 'ты', 'он', 'она', 'оно', 'мы', 'вы', 'они', 'меня', 'тебя', 'его', 'её', 'нас', 'вас', 'их', 'мне', 'тебе', 'ему', 'ей', 'нам', 'вам', 'им', 'себя',
    'мой', 'твой', 'его', 'её', 'наш', 'ваш', 'их', 'свой', 'этот', 'тот', 'такой', 'таков', 'столько', 'сколько', 'несколько', 'весь', 'всякий', 'каждый', 'любой', 'другой', 'иной', 'сам', 'самый',
    'это', 'эти', 'эта', 'этот', 'тех', 'те', 'там', 'тут', 'здесь', 'тогда', 'теперь', 'сейчас', 'уже', 'ещё', 'всё', 'все',
    'продам', 'предлагаю', 'смотрите', 'новый', 'новое', 'новая', 'хороший', 'отличный', 'крутой',
    'вкл', 'выкл', 'так', 'такое', 'будто', 'почти', 'неужели', 'разве', 'ведь', 'всего', 'всего-навсего'
]);

function isStopWord(word) {
    return STOP_WORDS.has(word.toLowerCase());
}

function isNumericWord(word) {
    return /^\d+$/.test(word);
}

const MIN_WORD_LEN = 4;