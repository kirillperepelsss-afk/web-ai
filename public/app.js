
(() => {
  'use strict';

  const form = document.querySelector('#askForm');
  const input = document.querySelector('#question');
  const button = document.querySelector('#askButton');
  const counter = document.querySelector('#counter');
  const result = document.querySelector('#result');
  const answer = document.querySelector('#answer');
  const sources = document.querySelector('#sources');
  const header = document.querySelector('header');

  if (!form || !input || !button || !counter ||
      !result || !answer || !sources || !header) {
    console.error('WebAI: не найдены необходимые элементы страницы.');
    return;
  }

  const STORAGE_KEY = 'webai-chat-history-v1';
  const MAX_CHATS = 50;
  const MAX_MESSAGES = 100;
  const LOADING_TEXT = 'Ищу актуальную информацию в интернете…';

  let chats = loadChats();
  let activeChatId = null;
  let isLoading = false;

  function createId() {
    return typeof crypto !== 'undefined' &&
      typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function loadChats() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

      if (!Array.isArray(saved)) return [];

      return saved
        .filter(chat =>
          chat &&
          typeof chat.id === 'string' &&
          Array.isArray(chat.messages)
        )
        .map(chat => ({
          id: chat.id,
          title: typeof chat.title === 'string'
            ? chat.title.slice(0, 100)
            : 'Новый чат',
          createdAt: Number(chat.createdAt) || Date.now(),
          updatedAt: Number(chat.updatedAt) || Date.now(),
          messages: chat.messages
            .filter(message =>
              message &&
              typeof message.question === 'string' &&
              typeof message.answer === 'string'
            )
            .slice(-MAX_MESSAGES)
            .map(message => ({
              question: message.question.slice(0, 4000),
              answer: message.answer.slice(0, 30000),
              sources: Array.isArray(message.sources)
                ? message.sources
                    .filter(source =>
                      source &&
                      typeof source.url === 'string'
                    )
                    .slice(0, 20)
                    .map(source => ({
                      title: typeof source.title === 'string'
                        ? source.title.slice(0, 300)
                        : '',
                      url: source.url.slice(0, 2000)
                    }))
                : []
            }))
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_CHATS);
    } catch (error) {
      console.warn('WebAI: не удалось прочитать историю чатов.', error);
      return [];
    }
  }

  function saveChats() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
      return true;
    } catch (error) {
      console.warn('WebAI: не удалось сохранить историю чатов.', error);
      return false;
    }
  }

  function validUrl(value) {
    try {
      const url = new URL(value, window.location.origin);
      return url.protocol === 'https:' || url.protocol === 'http:'
        ? url.href
        : null;
    } catch {
      return null;
    }
  }

  function safeSources(items) {
    if (!Array.isArray(items)) return [];

    return items
      .filter(item => item && typeof item.url === 'string')
      .map(item => {
        const url = validUrl(item.url);
        if (!url) return null;

        return {
          title: typeof item.title === 'string'
            ? item.title.slice(0, 300)
            : url,
          url
        };
      })
      .filter(Boolean)
      .slice(0, 20);
  }

  const style = document.createElement('style');
  style.textContent = `
    .webai-history-toggle {
      margin-left: auto;
      padding: 9px 13px;
      color: #ded7ff;
      background: rgba(139,92,246,.12);
      border: 1px solid rgba(167,139,250,.25);
      border-radius: 12px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 650;
    }
    .webai-history-toggle:hover {
      background: rgba(139,92,246,.22);
    }
    .webai-history-overlay {
      position: fixed;
      inset: 0;
      z-index: 9998;
      background: rgba(2,4,12,.68);
      opacity: 0;
      visibility: hidden;
      transition: opacity .2s ease, visibility .2s ease;
    }
    .webai-history-overlay.open {
      opacity: 1;
      visibility: visible;
    }
    .webai-history-panel {
      position: fixed;
      z-index: 9999;
      top: 0;
      left: 0;
      bottom: 0;
      width: min(340px, 88vw);
      padding: 22px 16px;
      display: flex;
      flex-direction: column;
      color: #f5f6ff;
      background: #0d101b;
      border-right: 1px solid rgba(151,164,255,.16);
      box-shadow: 20px 0 70px rgba(0,0,0,.3);
      transform: translateX(-105%);
      transition: transform .23s ease;
    }
    .webai-history-panel.open {
      transform: translateX(0);
    }
    .webai-history-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 17px;
    }
    .webai-history-title {
      font-size: 17px;
      font-weight: 750;
    }
    .webai-history-actions {
      display: flex;
      gap: 8px;
    }
    .webai-history-action {
      padding: 8px 10px;
      color: #ddd6fe;
      background: #19172a;
      border: 1px solid #302849;
      border-radius: 10px;
      cursor: pointer;
      font-size: 12px;
    }
    .webai-history-list {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .webai-history-empty {
      padding: 20px 8px;
      color: #8992aa;
      font-size: 13px;
      line-height: 1.7;
    }
    .webai-history-item {
      display: flex;
      align-items: stretch;
      gap: 4px;
      padding: 4px;
      border: 1px solid transparent;
      border-radius: 12px;
      background: transparent;
    }
    .webai-history-item.active {
      background: rgba(139,92,246,.12);
      border-color: rgba(139,92,246,.23);
    }
    .webai-history-open {
      min-width: 0;
      flex: 1;
      padding: 9px;
      color: #e6e8f5;
      text-align: left;
      border: 0;
      background: transparent;
      cursor: pointer;
    }
    .webai-history-name {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      font-weight: 600;
    }
    .webai-history-date {
      display: block;
      margin-top: 5px;
      color: #858da5;
      font-size: 11px;
    }
    .webai-history-delete {
      align-self: center;
      padding: 8px;
      color: #929ab0;
      border: 0;
      border-radius: 8px;
      background: transparent;
      cursor: pointer;
    }
    .webai-history-delete:hover {
      color: #fda4af;
      background: rgba(244,63,94,.1);
    }
    .webai-history-footer {
      padding-top: 13px;
      color: #788198;
      font-size: 11px;
      line-height: 1.6;
    }
    .webai-message {
      margin-top: 18px;
      padding: 16px;
      border: 1px solid rgba(151,164,255,.13);
      border-radius: 15px;
      background: rgba(255,255,255,.018);
    }
    .webai-message-question {
      margin-bottom: 12px;
      padding: 11px 13px;
      color: #eeeaff;
      background: rgba(139,92,246,.12);
      border: 1px solid rgba(139,92,246,.13);
      border-radius: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.6;
    }
    .webai-message-label {
      margin-bottom: 7px;
      color: #b9a5ff;
      font-size: 11px;
      font-weight: 750;
      letter-spacing: .8px;
      text-transform: uppercase;
    }
    .webai-message-answer {
      color: #e8ebf6;
      font-size: 14px;
      line-height: 1.8;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .webai-message-sources {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-top: 12px;
    }
    .webai-message-sources a {
      color: #c4b5fd;
      font-size: 12px;
      line-height: 1.5;
      overflow-wrap: anywhere;
      text-decoration: none;
    }
    .webai-message-sources a:hover {
      text-decoration: underline;
    }
    .webai-message-tools {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }
    .webai-copy-button {
      padding: 7px 10px;
      color: #b9c0d6;
      background: #171b29;
      border: 1px solid #2a3042;
      border-radius: 9px;
      cursor: pointer;
      font-size: 11px;
    }
    .webai-copy-button:hover {
      color: #fff;
    }
    @media (max-width: 600px) {
      .webai-history-toggle {
        padding: 8px 10px;
        font-size: 12px;
      }
      .webai-message {
        padding: 12px;
      }
    }
  `;
  document.head.appendChild(style);

  const historyToggle = document.createElement('button');
  historyToggle.type = 'button';
  historyToggle.className = 'webai-history-toggle';
  historyToggle.textContent = '☰ История';
  historyToggle.setAttribute('aria-label', 'Открыть историю чатов');
  header.appendChild(historyToggle);

  const overlay = document.createElement('div');
  overlay.className = 'webai-history-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  const panel = document.createElement('aside');
  panel.className = 'webai-history-panel';
  panel.setAttribute('aria-label', 'История чатов');

  const top = document.createElement('div');
  top.className = 'webai-history-top';

  const panelTitle = document.createElement('div');
  panelTitle.className = 'webai-history-title';
  panelTitle.textContent = 'Твои чаты';

  const actions = document.createElement('div');
  actions.className = 'webai-history-actions';

  const newChatButton = document.createElement('button');
  newChatButton.type = 'button';
  newChatButton.className = 'webai-history-action';
  newChatButton.textContent = '+ Новый';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'webai-history-action';
  closeButton.textContent = 'Закрыть';
  closeButton.setAttribute('aria-label', 'Закрыть историю');

  actions.append(newChatButton, closeButton);
  top.append(panelTitle, actions);

  const list = document.createElement('div');
  list.className = 'webai-history-list';

  const footer = document.createElement('div');
  footer.className = 'webai-history-footer';
  footer.textContent =
    'История хранится в этом браузере. Очистка данных сайта может удалить её.';

  panel.append(top, list, footer);
  document.body.append(overlay, panel);

  function openHistory() {
    renderHistory();
    overlay.classList.add('open');
    panel.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    closeButton.focus();
  }

  function closeHistory() {
    overlay.classList.remove('open');
    panel.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    historyToggle.focus();
  }

  historyToggle.addEventListener('click', openHistory);
  closeButton.addEventListener('click', closeHistory);
  overlay.addEventListener('click', closeHistory);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel.classList.contains('open')) {
      closeHistory();
    }
  });

  function updateCounter() {
    counter.textContent = `${input.value.length} / 4000`;
  }

  input.addEventListener('input', updateCounter);
  updateCounter();

  document.querySelectorAll('.examples button').forEach(item => {
    item.addEventListener('click', () => {
      input.value = item.textContent.trim();
      updateCounter();
      input.focus();
    });
  });

  function formatDate(timestamp) {
    try {
      return new Date(timestamp).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'short'
      });
    } catch {
      return '';
    }
  }

  function renderHistory() {
    list.replaceChildren();

    if (!chats.length) {
      const empty = document.createElement('div');
      empty.className = 'webai-history-empty';
      empty.textContent =
        'Пока нет сохранённых чатов. Задай NexAi первый вопрос — он появится здесь.';
      list.appendChild(empty);
      return;
    }

    chats
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .forEach(chat => {
        const item = document.createElement('div');
        item.className = 'webai-history-item';

        if (chat.id === activeChatId) {
          item.classList.add('active');
        }

        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'webai-history-open';

        const name = document.createElement('span');
        name.className = 'webai-history-name';
        name.textContent = chat.title || 'Новый чат';

        const date = document.createElement('span');
        date.className = 'webai-history-date';
        date.textContent = formatDate(chat.updatedAt);

        open.append(name, date);
        open.addEventListener('click', () => {
          if (isLoading) return;

          activeChatId = chat.id;
          renderChat(chat);
          renderHistory();
          closeHistory();
        });

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'webai-history-delete';
        remove.textContent = '✕';
        remove.setAttribute('aria-label', `Удалить чат: ${chat.title}`);
        remove.title = 'Удалить чат';

        remove.addEventListener('click', event => {
          event.stopPropagation();
          if (isLoading) return;

          const confirmed = window.confirm(
            `Удалить чат «${chat.title}»? Это действие нельзя отменить.`
          );

          if (!confirmed) return;

          chats = chats.filter(entry => entry.id !== chat.id);

          if (activeChatId === chat.id) {
            activeChatId = null;
            resetView();
          }

          saveChats();
          renderHistory();
        });

        item.append(open, remove);
        list.appendChild(item);
      });
  }

  function createChat(question) {
    const now = Date.now();

    const chat = {
      id: createId(),
      title: question.slice(0, 65) || 'Новый чат',
      createdAt: now,
      updatedAt: now,
      messages: []
    };

    chats.unshift(chat);
    activeChatId = chat.id;
    return chat;
  }

  function getActiveChat() {
    return chats.find(chat => chat.id === activeChatId) || null;
  }

  function scrollToLatestMessage() {
    window.setTimeout(() => {
      const lastMessage = answer.lastElementChild;

      if (lastMessage) {
        lastMessage.scrollIntoView({
          behavior: 'smooth',
          block: 'end'
        });
      } else {
        result.scrollIntoView({
          behavior: 'smooth',
          block: 'end'
        });
      }
    }, 100);
  }

  function renderChat(chat) {
    result.classList.remove('hidden');
    answer.replaceChildren();
    sources.replaceChildren();

    if (!chat || chat.messages.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'webai-message-answer';
      empty.textContent = 'Напиши вопрос, чтобы продолжить этот чат.';
      answer.appendChild(empty);
      return;
    }

    chat.messages.forEach(message => {
      const card = document.createElement('div');
      card.className = 'webai-message';

      const question = document.createElement('div');
      question.className = 'webai-message-question';
      question.textContent = message.question;

      const label = document.createElement('div');
      label.className = 'webai-message-label';
      label.textContent = 'Ответ WebAI';

      const reply = document.createElement('div');
      reply.className = 'webai-message-answer';
      reply.textContent = message.answer;

      card.append(question, label, reply);

      if (message.sources.length) {
        const sourceList = document.createElement('div');
        sourceList.className = 'webai-message-sources';

        const heading = document.createElement('div');
        heading.className = 'webai-message-label';
        heading.textContent = 'Источники';
        sourceList.appendChild(heading);

        message.sources.forEach(source => {
          const url = validUrl(source.url);
          if (!url) return;

          const link = document.createElement('a');
          link.href = url;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = source.title || url;
          sourceList.appendChild(link);
        });

        card.appendChild(sourceList);
      }

      const tools = document.createElement('div');
      tools.className = 'webai-message-tools';

      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'webai-copy-button';
      copy.textContent = 'Копировать ответ';

      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(message.answer);
          copy.textContent = 'Скопировано ✓';
        } catch {
          copy.textContent = 'Не удалось скопировать';
        }

        window.setTimeout(() => {
          copy.textContent = 'Копировать ответ';
        }, 1800);
      });

      tools.appendChild(copy);
      card.appendChild(tools);
      answer.appendChild(card);
    });

    scrollToLatestMessage();
  }

  function resetView() {
    result.classList.add('hidden');
    answer.replaceChildren();
    sources.replaceChildren();
    input.value = '';
    updateCounter();
  }

  newChatButton.addEventListener('click', () => {
    if (isLoading) return;

    activeChatId = null;
    resetView();
    closeHistory();
    input.focus();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const question = input.value.trim();
    if (!question || isLoading) return;

    // Сразу очищаем поле ввода, сохраняя текст вопроса в переменной.
    input.value = '';
    updateCounter();

    isLoading = true;
    button.disabled = true;
    button.textContent = 'Ищу…';

    let chat = getActiveChat();
    if (!chat) chat = createChat(question);

    // Передаём модели предыдущие завершённые сообщения этого чата.
    const history = chat.messages
      .filter(message =>
        message.answer &&
        message.answer !== LOADING_TEXT &&
        !message.answer.startsWith('Не удалось получить ответ:')
      )
      .flatMap(message => [
        {
          role: 'user',
          content: message.question
        },
        {
          role: 'assistant',
          content: message.answer
        }
      ])
      .slice(-12);

    const message = {
      question,
      answer: LOADING_TEXT,
      sources: []
    };

    chat.messages.push(message);
    chat.messages = chat.messages.slice(-MAX_MESSAGES);
    chat.updatedAt = Date.now();

    saveChats();
    renderChat(chat);
    renderHistory();

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          question,
          history
        })
      });

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error('Сервер вернул ответ в неизвестном формате.');
      }

      if (!response.ok) {
        throw new Error(
          data.error || `Ошибка сервера (${response.status}).`
        );
      }

      message.answer =
        typeof data.answer === 'string' && data.answer.trim()
          ? data.answer
          : 'Сервер не вернул текст ответа.';

      message.sources = safeSources(data.sources);
    } catch (error) {
      console.error('WebAI: ошибка отправки вопроса:', error);
      message.answer = `Не удалось получить ответ: ${error.message}`;
    } finally {
      chat.updatedAt = Date.now();

      chats = chats
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, MAX_CHATS);

      saveChats();

      isLoading = false;
      button.disabled = false;
      button.textContent = 'Спросить ↗';

      if (activeChatId === chat.id) {
        renderChat(chat);
      }

      renderHistory();
      input.focus();
    }
  });

  renderHistory();
})();
