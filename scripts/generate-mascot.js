#!/usr/bin/env node
/**
 * Generate pixel art mascot variations using Gemini image generation.
 *
 * Usage:
 *   node generate-mascot.js <prompt> <output.png> [--base <base-image.png>]
 *
 * Examples:
 *   node generate-mascot.js "64x64 pixel art ghost, blue-purple, dark background" mascot.png
 *   node generate-mascot.js "same character wearing a pirate hat" pirate.png --base mascot.png
 *
 * Env: GEMINI_API_KEYS (comma-separated)
 */

const { GoogleGenAI, Modality } = require("@google/genai");
const fs = require("fs");

const keys = (process.env.GEMINI_API_KEYS || "").split(",").filter(Boolean);
if (!keys.length) { console.error("Set GEMINI_API_KEYS env var"); process.exit(1); }

let ki = 0;

async function generate(prompt, outputPath, basePath) {
  const parts = [];
  if (basePath) {
    const b64 = fs.readFileSync(basePath).toString("base64");
    parts.push({ inlineData: { data: b64, mimeType: "image/png" } });
  }
  parts.push({ text: prompt });

  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(ki + attempt) % keys.length];
    const ai = new GoogleGenAI({ apiKey: key });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ role: "user", parts }],
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
      });
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const buf = Buffer.from(part.inlineData.data, "base64");
          fs.writeFileSync(outputPath, buf);
          console.log(`Saved: ${outputPath} (${buf.length} bytes)`);
        }
        if (part.text) console.log(part.text.slice(0, 100));
      }
      ki = (ki + attempt + 1) % keys.length;
      return;
    } catch (e) {
      if (e.message?.includes("429")) { console.log(`Key ${(ki + attempt) % keys.length} rate limited...`); continue; }
      throw e;
    }
  }
  console.error("All keys exhausted");
}

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
let basePath = null;
if (baseIdx !== -1) {
  basePath = args[baseIdx + 1];
  args.splice(baseIdx, 2);
}

const [prompt, output] = args;
if (!prompt || !output) {
  console.error("Usage: generate-mascot.js <prompt> <output.png> [--base <base.png>]");
  process.exit(1);
}

generate(prompt, output, basePath).catch((e) => { console.error(e.message); process.exit(1); });
