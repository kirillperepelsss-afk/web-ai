
const form = document.getElementById("askForm");
const questionInput = document.getElementById("question");
const askButton = document.getElementById("askButton");
const attachButton = document.getElementById("attachButton");
const fileInput = document.getElementById("fileInput");
const fileInfo = document.getElementById("fileInfo");
const fileName = document.getElementById("fileName");
const removeFileButton = document.getElementById("removeFile");
const counter = document.getElementById("counter");
const result = document.getElementById("result");
const answerElement = document.getElementById("answer");
const sourcesElement = document.getElementById("sources");

const STORAGE_KEY = "webai-chat-history-v1";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_QUESTION_LENGTH = 4000;
const MAX_CONTEXT_MESSAGES = 12;

const ALLOWED_EXTENSIONS = [
  "pdf",
  "txt",
  "docx",
  "png",
  "jpg",
  "jpeg",
  "webp"
];

const LOADING_TEXT = "Обрабатываю запрос…";

let selectedFile = null;
let chatHistory = loadHistory();
let isLoading = false;

function loadHistory() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Не удалось загрузить историю:", error);
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory));
  } catch (error) {
    console.error("Не удалось сохранить историю:", error);
  }
}

function updateCounter() {
  if (!counter) return;

  counter.textContent =
    `${questionInput.value.length} / ${MAX_QUESTION_LENGTH}`;
}

function showFile(file) {
  if (!fileInfo || !fileName) return;

  fileName.textContent = `📎 ${file.name}`;
  fileInfo.style.display = "block";
}

function clearSelectedFile() {
  selectedFile = null;

  if (fileInput) {
    fileInput.value = "";
  }

  if (fileInfo) {
    fileInfo.style.display = "none";
  }

  if (fileName) {
    fileName.textContent = "";
  }
}

function getExtension(filename) {
  const parts = filename.split(".");
  return parts.length > 1
    ? parts.pop().toLowerCase()
    : "";
}

function setLoading(loading) {
  isLoading = loading;

  if (askButton) {
    askButton.disabled = loading;
    askButton.textContent = loading
      ? "Думаю..."
      : "Спросить ↗";
  }

  if (questionInput) {
    questionInput.disabled = loading;
  }

  if (attachButton) {
    attachButton.disabled = loading;
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return entities[character];
  });
}

function formatAnswer(text) {
  let safe = escapeHTML(text);

  safe = safe.replace(
    /\*\*(.*?)\*\*/g,
    "<strong>$1</strong>"
  );

  safe = safe.replace(
    /\*(.*?)\*/g,
    "<em>$1</em>"
  );

  safe = safe.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  safe = safe.replace(
    /^### (.*$)/gm,
    "<h3>$1</h3>"
  );

  safe = safe.replace(
    /^## (.*$)/gm,
    "<h2>$1</h2>"
  );

  safe = safe.replace(
    /^# (.*$)/gm,
    "<h2>$1</h2>"
  );

  safe = safe.replace(
    /^- (.*$)/gm,
    "• $1"
  );

  safe = safe.replace(/\n/g, "<br>");

  return safe;
}

function showAnswer(text) {
  result.classList.remove("hidden");
  answerElement.innerHTML = formatAnswer(text);

  if (sourcesElement) {
    sourcesElement.innerHTML = "";
  }

  result.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function addToHistory(role, content) {
  chatHistory.push({
    role,
    content
  });

  chatHistory = chatHistory.slice(-MAX_CONTEXT_MESSAGES);
  saveHistory();
}

function getContext() {
  return chatHistory.slice(-MAX_CONTEXT_MESSAGES);
}

function getErrorMessage(data, response) {
  if (data && typeof data.error === "string") {
    return data.error;
  }

  if (response.status === 429) {
    return "Сейчас нет доступной квоты ИИ. Попробуйте позже.";
  }

  return "Произошла ошибка. Попробуйте ещё раз.";
}

async function sendQuestion(question, file = null) {
  const history = getContext();

  let response;

  if (file) {
    const formData = new FormData();

    formData.append("file", file);
    formData.append("question", question);
    formData.append("history", JSON.stringify(history));

    response = await fetch("/api/ask-with-file", {
      method: "POST",
      body: formData
    });
  } else {
    response = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        question,
        history
      })
    });
  }

  let data;

  try {
    data = await response.json();
  } catch {
    throw new Error("Сервер вернул некорректный ответ.");
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(data, response));
  }

  if (!data.answer) {
    throw new Error("ИИ не вернул ответ. Попробуйте ещё раз.");
  }

  return data;
}

async function handleSubmit(event) {
  event.preventDefault();

  if (isLoading) return;

  const question = questionInput.value.trim();

  if (!question) {
    questionInput.focus();
    return;
  }

  if (question.length > MAX_QUESTION_LENGTH) {
    alert("Вопрос слишком длинный.");
    return;
  }

  const file = selectedFile;

  if (file) {
    const extension = getExtension(file.name);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      alert(
        "Поддерживаются PDF, TXT, DOCX, PNG, JPG, JPEG и WEBP."
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("Файл слишком большой. Максимальный размер — 10 МБ.");
      return;
    }
  }

  const displayQuestion = file
    ? `${question}\n\n📎 Файл: ${file.name}`
    : question;

  addToHistory("user", displayQuestion);

  questionInput.value = "";
  updateCounter();

  result.classList.remove("hidden");

  answerElement.textContent = LOADING_TEXT;

  if (sourcesElement) {
    sourcesElement.innerHTML = "";
  }

  setLoading(true);

  try {
    const data = await sendQuestion(question, file);

    addToHistory("assistant", data.answer);

    showAnswer(data.answer);

    if (data.truncated) {
      const notice = document.createElement("p");
      notice.textContent =
        "Примечание: обработана только начальная часть большого файла.";
      notice.style.opacity = "0.7";
      answerElement.appendChild(notice);
    }

    clearSelectedFile();
  } catch (error) {
    console.error("Ошибка NexAI:", error);

    showAnswer(
      `Не удалось получить ответ.\n\n${error.message}`
    );

    // Возвращаем вопрос, чтобы его можно было отправить повторно.
    questionInput.value = question;
    updateCounter();
  } finally {
    setLoading(false);
  }
}

if (attachButton && fileInput) {
  attachButton.addEventListener("click", () => {
    if (!isLoading) {
      fileInput.click();
    }
  });
}

if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];

    if (!file) return;

    const extension = getExtension(file.name);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      alert(
        "Поддерживаются PDF, TXT, DOCX, PNG, JPG, JPEG и WEBP."
      );

      clearSelectedFile();
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("Файл слишком большой. Максимальный размер — 10 МБ.");
      clearSelectedFile();
      return;
    }

    selectedFile = file;
    showFile(file);
  });
}

if (removeFileButton) {
  removeFileButton.addEventListener("click", () => {
    clearSelectedFile();
  });
}

if (questionInput) {
  questionInput.addEventListener("input", updateCounter);

  questionInput.addEventListener("keydown", event => {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (form) {
        form.requestSubmit();
      }
    }
  });
}

if (form) {
  form.addEventListener("submit", handleSubmit);
}

// Кнопки с примерами вопросов
document.querySelectorAll(".examples button").forEach(button => {
  button.addEventListener("click", () => {
    questionInput.value = button.textContent.trim();
    updateCounter();
    questionInput.focus();
  });
});

// Начальная настройка
updateCounter();

console.log("NexAI готов к работе.");
