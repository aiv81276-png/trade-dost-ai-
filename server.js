import express from "express";
import multer from "multer";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ["image/png", "image/jpeg", "image/webp"].includes(file.mimetype);
    cb(ok ? null : new Error("Only PNG, JPG, and WEBP images are allowed."), ok);
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/analyze", upload.single("chart"), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({ error: "Server setup pending: OPENAI_API_KEY is not configured." });
    }
    if (!req.file) return res.status(400).json({ error: "Please upload a chart screenshot." });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || "gpt-6-astra",
      instructions: `You are Trade Dost, an educational chart-reading assistant. Analyze only what is visibly supported by the screenshot. Never promise profit or certainty. Do not treat synthetic/off-hours/OTC-style indices as reliably predictable. Do not invent exact prices: if axis labels or price scale are unclear, say so and give approximate zones only when visually defensible. Identify instrument, timeframe, visible current price if legible, trend/structure, approximate support and resistance zones, possible bullish and bearish scenarios, invalidation/stop area concept, and risk cautions. If image is unclear or chart data insufficient, return WAIT and explain. Avoid telling the user to place a trade or stake a specific amount. Respond in simple Hindi using headings: Chart summary, Support, Resistance, Bias (UP/DOWN/WAIT), Possible setup (conditional), Risk/invalidations, Confidence & limitations. State that screenshot-only analysis is not live data.`,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Is uploaded trading chart screenshot ka cautious educational analysis Hindi mein karo. Price levels tabhi do jab clearly readable hon." },
          { type: "input_image", image_url: dataUrl, detail: "high" }
        ]
      }]
    });
    res.json({ analysis: response.output_text || "Analysis text was not returned." });
  } catch (err) {
    console.error("analysis_error", err?.message || err);
    res.status(500).json({ error: "Analysis request failed. Please check server logs and API configuration." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true, aiConfigured: Boolean(process.env.OPENAI_API_KEY) }));

app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || "Upload error." });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Trade Dost running on http://localhost:${port}`));
