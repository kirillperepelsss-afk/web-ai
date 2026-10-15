(() => {
'use strict';

const form = document.querySelector('#askForm');
const input = document.querySelector('#question');
const button = document.querySelector('#askButton');
const counter = document.querySelector('#counter');
const result = document.querySelector('#result');
const answer = document.querySelector('#answer');
const sources = document.querySelector('#sources');

// Проверяем наличие необходимых элементов страницы
if (!form || !input || !button || !counter || !result || !answer || !sources) {
console.error('WebAI: не найдены элементы страницы. Проверь index.html.');
return;
}

// Счётчик символов
function updateCounter() {
counter.textContent = "${input.value.length} / 4000";
}

input.addEventListener('input', updateCounter);
updateCounter();

// Примеры вопросов
document.querySelectorAll('.examples button').forEach(item => {
item.addEventListener('click', () => {
input.value = item.textContent.trim();
updateCounter();
input.focus();
});
});

// Отправка вопроса
form.addEventListener('submit', async event => {
event.preventDefault();

const question = input.value.trim();

if (!question || button.disabled) {
  return;
}

button.disabled = true;
button.textContent = 'Ищу…';

result.classList.remove('hidden');
answer.textContent = 'Ищу актуальную информацию в интернете…';
sources.replaceChildren();

try {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ question })
  });

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error('Сервер вернул ответ в неизвестном формате.');
  }

  if (!response.ok) {
    throw new Error(data.error || `Ошибка сервера (${response.status}).`);
  }

  answer.textContent =
    typeof data.answer === 'string' && data.answer.trim()
      ? data.answer
      : 'Сервер не вернул текст ответа.';

  if (Array.isArray(data.sources) && data.sources.length > 0) {
    const heading = document.createElement('div');
    heading.className = 'sources-title';
    heading.textContent = 'Источники';
    sources.appendChild(heading);

    data.sources.forEach(source => {
      if (!source || typeof source.url !== 'string' || !source.url.trim()) {
        return;
      }

      let url;

      try {
        url = new URL(source.url, window.location.origin);
      } catch {
        return;
      }

      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return;
      }

      const link = document.createElement('a');
      link.className = 'source';
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = source.title || url.href;
      sources.appendChild(link);
    });
  }

} catch (error) {
  console.error('WebAI: ошибка отправки вопроса:', error);
  answer.textContent = `Не удалось получить ответ: ${error.message}`;
} finally {
  button.disabled = false;
  button.textContent = 'Спросить ↗';
}

});
})();
