import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const port = process.env.PORT || 10000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/ask", async (req, res) => {
  try {
    const question = String(req.body?.question || "").trim();

    if (!question) {
      return res.status(400).json({ error: "Введите вопрос." });
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({
        error: "OPENROUTER_API_KEY не настроен."
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api/v1"
    });

    const response = await client.chat.completions.create({
      model: "openrouter/free",
      messages: [
        {
          role: "system",
          content:
            "Ты WebAI — полезный AI-помощник. Отвечай на русском языке, ясно и по существу. Не выдумывай факты."
        },
        {
          role: "user",
          content: question
        }
      ]
    });

    const answer =
      response.choices?.[0]?.message?.content ||
      "Не удалось получить ответ.";

    res.json({ answer, sources: [] });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error?.message || "Ошибка сервера."
    });
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`WebAI running on port ${port}`);
});
