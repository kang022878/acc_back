// src/routes/security-chat.js
const express = require("express");
const asyncHandler = require("../middleware/asyncHandler");
const OpenAI = require("openai");

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "OpenAI API key not configured" });
    }

    const { messages } = req.body; // [{ role: "user"|"assistant", content: "..." }, ...]

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages is required" });
    }

    const systemPrompt = {
      role: "system",
      content:
        "너는 한국어로 답하는 보안 어시스턴트야. " +
        "계정/개인정보/피싱/2FA/비밀번호 관리에 대한 실용적이고 안전한 조언을 제공해. " +
        "불법/해킹/침입을 돕는 요청은 거절하고 안전한 대안을 안내해."
    };

    const trimmed = messages.slice(-12).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content ?? "")
    }));

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [systemPrompt, ...trimmed],
      temperature: 0.4
    });

    const reply =
      completion.choices?.[0]?.message?.content ||
      "답변을 생성하지 못했어요. 잠시 후 다시 시도해 주세요.";

    res.json({ reply });
  })
);

module.exports = router;
