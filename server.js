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

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "OPENAI_API_KEY не настроен."
      });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "system",
          content:
            "Ты WebAI — полезный веб-исследователь. Используй веб-поиск для актуальной информации. Отвечай на русском языке, ясно и по существу. Не выдумывай факты. При возможности указывай источники."
        },
        {
          role: "user",
          content: question
        }
      ]
    });

    const answer = response.output_text || "Не удалось получить ответ.";
    const sources = [];

    for (const item of response.output || []) {
      if (item.type === "message") {
        for (const part of item.content || []) {
          for (const ann of part.annotations || []) {
            if (ann.type === "url_citation" && ann.url) {
              sources.push({
                title: ann.title || ann.url,
                url: ann.url
              });
            }
          }
        }
      }
    }

    const uniqueSources = Array.from(
      new Map(sources.map((s) => [s.url, s])).values()
    );

    res.json({
      answer,
      sources: uniqueSources
    });
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
