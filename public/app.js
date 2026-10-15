const form = document.querySelector('#askForm');
const input = document.querySelector('#question');
const button = document.querySelector('#askButton');
const counter = document.querySelector('#counter');
const result = document.querySelector('#result');
const answer = document.querySelector('#answer');
const sources = document.querySelector('#sources');
const voiceButton = document.querySelector('#voiceButton');

// Счётчик символов
input.addEventListener('input', () => {
counter.textContent = "${input.value.length} / 4000";
});

// Примеры вопросов
document.querySelectorAll('.examples button').forEach(item => {
item.addEventListener('click', () => {
input.value = item.textContent;
input.dispatchEvent(new Event('input'));
input.focus();
});
});

let recognition = null;
let isListening = false;
let baseText = '';

const SpeechRecognition =
window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
recognition = new SpeechRecognition();
recognition.lang = 'ru-RU';
recognition.continuous = true;
recognition.interimResults = true;

recognition.onstart = () => {
isListening = true;
baseText = input.value.trim();

voiceButton.classList.add('recording');
voiceButton.title = 'Остановить запись';
voiceButton.setAttribute('aria-label', 'Остановить запись');

};

recognition.onresult = event => {
// Каждый раз собираем текущие результаты заново.
// Не добавляем повторно ранее распознанные фразы.
const spokenParts = [];

for (let i = 0; i < event.results.length; i++) {
  const phrase = event.results[i][0].transcript.trim();

  if (phrase) {
    spokenParts.push(phrase);
  }
}

const spokenText = spokenParts.join(' ').trim();
const fullText = [baseText, spokenText]
  .filter(Boolean)
  .join(' ');

input.value = fullText.slice(0, 4000);
input.dispatchEvent(new Event('input'));

};

recognition.onerror = event => {
console.error('Ошибка голосового ввода:', event.error);
};

recognition.onend = () => {
isListening = false;
resetVoiceButton();
};

} else {
voiceButton.disabled = true;
voiceButton.title = 'Голосовой ввод не поддерживается этим браузером';
voiceButton.style.opacity = '0.5';
}

function resetVoiceButton() {
voiceButton.classList.remove('recording');
voiceButton.title = 'Голосовой ввод';
voiceButton.setAttribute('aria-label', 'Голосовой ввод');
}

function stopListening() {
if (recognition && isListening) {
recognition.stop();
}

isListening = false;
resetVoiceButton();
}

// Кнопка микрофона
voiceButton.addEventListener('click', () => {
if (!recognition) {
alert('Голосовой ввод не поддерживается этим браузером.');
return;
}

if (isListening) {
stopListening();
return;
}

baseText = input.value.trim();

try {
recognition.start();
} catch (error) {
console.error('Не удалось запустить микрофон:', error);
}
});

// Отправка вопроса в WebAI
form.addEventListener('submit', async event => {
event.preventDefault();

const question = input.value.trim();
if (!question) return;

if (isListening) {
stopListening();
}

button.disabled = true;
button.textContent = 'Ищу…';

result.classList.remove('hidden');
answer.textContent = 'Ищу актуальную информацию в интернете…';
sources.innerHTML = '';

try {
const response = await fetch('/api/ask', {
method: 'POST',
headers: {
'Content-Type': 'application/json'
},
body: JSON.stringify({ question })
});

const data = await response.json();

if (!response.ok) {
  throw new Error(data.error || 'Ошибка сервера');
}

answer.textContent = data.answer || 'Ответ не получен.';

if (Array.isArray(data.sources) && data.sources.length) {
  const heading = document.createElement('div');
  heading.className = 'sources-title';
  heading.textContent = 'Источники';
  sources.appendChild(heading);

  data.sources.forEach(source => {
    if (!source.url) return;

    const link = document.createElement('a');
    link.className = 'source';
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = source.title || source.url;
    sources.appendChild(link);
  });
}

} catch (error) {
answer.textContent = "Ошибка: ${error.message}";
} finally {
button.disabled = false;
button.textContent = 'Спросить ↗';
}
});
