
import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp"];
    cb(
      allowed.includes(file.mimetype)
        ? null
        : new Error("Only PNG, JPG and WEBP images are allowed."),
      allowed.includes(file.mimetype)
    );
  }
});

app.use(express.static(path.join(__dirname, "public")));

app.post("/api/analyze", upload.single("chart"), async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "GEMINI_API_KEY is not configured."
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Please upload a chart screenshot."
      });
    }

    const prompt = `
You are Trade Dost, an educational trading chart analysis assistant.

Analyze only what is visible in the uploaded screenshot.
Never guarantee profit or certainty.
Do not invent prices or indicators.
If the chart is unclear, say WAIT.

Reply in simple Hindi using these headings:
1. Chart Summary
2. Trend
3. Support and Resistance
4. Bias (UP/DOWN/WAIT)
5. Possible Setup
6. Risk and Stop Loss Concept
7. Confidence and Limitations

Explain that screenshot analysis is not live market data.
Do not tell the user to invest a specific amount.
`;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: prompt }]
          },
          contents: [{
            role: "user",
            parts: [
              {
                text: "Is uploaded trading chart ka cautious educational analysis Hindi mein karo."
              },
              {
                inline_data: {
                  mime_type: req.file.mimetype,
                  data: req.file.buffer.toString("base64")
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.2
          }
        })
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("Gemini API error:", result);
      return res.status(502).json({
        error: "Gemini analysis failed. Please check API settings."
      });
    }

    const analysis = result.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("\n");

    res.json({
      analysis: analysis || "Analysis text was not returned."
    });

  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({
      error: "Analysis request failed. Check server logs."
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    aiConfigured: Boolean(process.env.GEMINI_API_KEY)
  });
});

app.use((err, req, res, next) => {
  res.status(400).json({
    error: err.message || "Upload error."
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Trade Dost running on port ${port}`);
});
