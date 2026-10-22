
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPT = `
Ты NexAI — полезный AI-помощник.
Отвечай на русском языке, ясно и по существу.
Учитывай предыдущие сообщения текущего диалога.
Понимай уточнения с учётом контекста разговора.
Не выдумывай факты. Если не уверен, честно сообщи об этом.
Не утверждай, что выполнял интернет-поиск, если его не было.
`.trim();

const MAX_QUESTION_LENGTH = 4000;
const MAX_CONTEXT_MESSAGES = 12;
const MAX_MESSAGE_LENGTH = 12000;

app.post("/api/ask", async (req, res) => {
  try {
    const question = String(req.body?.question || "").trim();

    if (!question) {
      return res.status(400).json({
        error: "Введите вопрос."
      });
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({
        error: "Вопрос слишком длинный. Максимум — 4000 символов."
      });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: "OPENROUTER_API_KEY не настроен."
      });
    }

    const suppliedHistory = Array.isArray(req.body?.history)
      ? req.body.history
      : [];

    const history = suppliedHistory
      .filter(message =>
        message &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        message.content.trim().length > 0
      )
      .slice(-MAX_CONTEXT_MESSAGES)
      .map(message => ({
        role: message.role,
        content: message.content.trim().slice(0, MAX_MESSAGE_LENGTH)
      }));

    const lastMessage = history[history.length - 1];

    if (
      lastMessage &&
      lastMessage.role === "user" &&
      lastMessage.content === question
    ) {
      history.pop();
    }

    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
      timeout: 60000,
      maxRetries: 1
    });

    const response = await client.chat.completions.create({
      model: "openrouter/free",
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT
        },
        ...history,
        {
          role: "user",
          content: question
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content;

    const answer =
      typeof content === "string" && content.trim()
        ? content.trim()
        : "Не удалось получить ответ.";

    return res.json({
      answer,
      sources: []
    });
  } catch (error) {
    console.error("NexAI API error:", error);

    if (error?.status === 429) {
      return res.status(429).json({
        error: "Слишком много запросов или временно нет доступной квоты. Попробуйте позже."
      });
    }

    return res.status(500).json({
      error: "Не удалось получить ответ от ИИ. Попробуйте ещё раз."
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`NexAI running on port ${port}`);
});
