const form = document.querySelector('#askForm');
const input = document.querySelector('#question');
const button = document.querySelector('#askButton');
const counter = document.querySelector('#counter');
const result = document.querySelector('#result');
const answer = document.querySelector('#answer');
const sources = document.querySelector('#sources');
const voiceButton = document.querySelector('#voiceButton');

input.addEventListener('input', () => {
counter.textContent = "${input.value.length} / 4000";
});

document.querySelectorAll('.examples button').forEach(b => {
b.addEventListener('click', () => {
input.value = b.textContent;
input.dispatchEvent(new Event('input'));
input.focus();
});
});

let recognition = null;
let isListening = false;
let baseText = '';
let finalText = '';

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
finalText = '';

voiceButton.classList.add('recording');
voiceButton.title = 'Остановить запись';
voiceButton.setAttribute('aria-label', 'Остановить запись');

};

recognition.onresult = event => {
let interimText = '';

for (let i = event.resultIndex; i < event.results.length; i++) {
  const transcript = event.results[i][0].transcript.trim();

  if (event.results[i].isFinal) {
    if (transcript) {
      finalText += (finalText ? ' ' : '') + transcript;
    }
  } else {
    interimText += (interimText ? ' ' : '') + transcript;
  }
}

const parts = [baseText, finalText, interimText].filter(Boolean);
input.value = parts.join(' ').slice(0, 4000);
input.dispatchEvent(new Event('input'));

};

recognition.onerror = event => {
console.error('Ошибка голосового ввода:', event.error);
stopListening();
};

recognition.onend = () => {
isListening = false;
resetVoiceButton();
};

} else {
voiceButton.disabled = true;
voiceButton.title = 'Голосовой ввод не поддерживается этим браузером';
voiceButton.setAttribute(
'aria-label',
'Голосовой ввод не поддерживается'
);
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
finalText = '';

try {
recognition.start();
} catch (error) {
console.error('Не удалось запустить голосовой ввод:', error);
}
});

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
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ question })
});

const data = await response.json();

if (!response.ok) {
  throw new Error(data.error || 'Ошибка сервера');
}

answer.textContent = data.answer || 'Ответ не получен.';

if (Array.isArray(data.sources) && data.sources.length) {
  const title = document.createElement('div');
  title.className = 'sources-title';
  title.textContent = 'Источники';
  sources.appendChild(title);

  data.sources.forEach(source => {
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
