#!/usr/bin/env node
const { GoogleGenAI, Modality } = require("@google/genai");
const fs = require("fs");
const { execSync } = require("child_process");

const keys = [
  "AIzaSyAsfG3de_EAguxGOftlbpjlAelXypw9F28",
  "AIzaSyCspkhVGjGnFMX9_3tI8a552T1bRjIiYVI",
  "AIzaSyD6Nmm-9i2EIcuwBgKVFtGvUBu1qp7xSOc",
  "AIzaSyCFspXIDmLNFtLte4AnuklLyA7JsvBNL0U",
  "AIzaSyDdkrkhMFfNs0SUG0CBF3XMPVCGr9NHVYs",
];
let ki = 0;

const PERSONAS = [
  "detective", "royal", "nerd", "pirate", "chill", "wizard", "chef", "chaos"
];

const STATES = [
  { name: "idle", prompt: "4 animation frames of it bobbing up and down gently, arranged in a 2x2 grid" },
  { name: "talk", prompt: "4 animation frames of it pulsing and glowing while talking, small sound waves emanating, arranged in a 2x2 grid" },
  { name: "listen", prompt: "4 animation frames of it looking around curiously, eye moving in different directions, arranged in a 2x2 grid" },
  { name: "thinking", prompt: "4 animation frames of it concentrating hard, eye squinting then opening wide with sparkles, arranged in a 2x2 grid" },
];

const ASSETS = "/Users/mac/dev/Phantom/extension/assets";
const MASCOTS = "/Users/mac/dev/Phantom/mascots";
const TMP = "/Users/mac/dev/Phantom/mascots/tmp_gen";

async function gen(prompt, basePath, outputPath) {
  const baseB64 = fs.readFileSync(basePath).toString("base64");
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const key = keys[(ki + attempt) % keys.length];
    const ai = new GoogleGenAI({ apiKey: key });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: [{ role: "user", parts: [
          { inlineData: { data: baseB64, mimeType: "image/png" } },
          { text: prompt },
        ]}],
        config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
      });
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const buf = Buffer.from(part.inlineData.data, "base64");
          fs.writeFileSync(outputPath, buf);
          console.log(`  Saved: ${outputPath} (${Math.round(buf.length/1024)}KB)`);
          ki = (ki + attempt + 1) % keys.length;
          return true;
        }
      }
    } catch (e) {
      if (e.message?.includes("429")) {
        continue;
      }
      console.log(`  Error: ${e.message?.slice(0, 100)}`);
      return false;
    }
  }
  console.log("  ALL KEYS EXHAUSTED - waiting 30s...");
  await new Promise(r => setTimeout(r, 30000));
  return gen(prompt, basePath, outputPath);
}

function extractAndNormalize(sheetPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  execSync(`magick "${sheetPath}" -fuzz 25% -transparent black "${sheetPath}"`);
  const detect = execSync(
    `magick "${sheetPath}" -alpha extract -threshold 10% -morphology Close Disk:5 ` +
    `-define connected-components:area-threshold=3000 -define connected-components:verbose=true ` +
    `-connected-components 8 null: 2>&1`
  ).toString();
  const regions = detect.split("\n")
    .filter(l => l.includes("srgb(255,255,255)"))
    .map(l => {
      const bbox = l.trim().split(/\s+/)[1];
      const centroid = l.trim().split(/\s+/)[2];
      const cx = parseFloat(centroid.split(",")[0]);
      const cy = parseFloat(centroid.split(",")[1]);
      return { bbox, cx, cy };
    })
    .sort((a, b) => a.cy === b.cy ? a.cx - b.cx : a.cy - b.cy);

  const count = Math.min(regions.length, 4);
  for (let i = 0; i < count; i++) {
    execSync(
      `magick "${sheetPath}" -crop "${regions[i].bbox}" +repage ` +
      `-resize 128x128 -background none -gravity center -extent 128x128 ` +
      `"${outDir}/${i + 1}.png"`
    );
  }
  return count;
}

async function main() {
  fs.mkdirSync(TMP, { recursive: true });

  for (const persona of PERSONAS) {
    const basePath = `${MASCOTS}/persona_${persona}.png`;
    if (!fs.existsSync(basePath)) {
      console.log(`SKIP ${persona} - no base image`);
      continue;
    }
    console.log(`\n=== ${persona.toUpperCase()} ===`);

    for (const state of STATES) {
      console.log(`  [${state.name}]`);
      const sheetPath = `${TMP}/${persona}_${state.name}.png`;
      const framesDir = `${ASSETS}/frames/${persona}_${state.name}`;

      const prompt = `Using this exact character (keep the same costume/accessories, same pixel art style, same colors), create ${state.prompt}. Pure black background (#000000). Each frame 512x512, total 1024x1024.`;

      const ok = await gen(prompt, basePath, sheetPath);
      if (!ok) { console.log(`  FAILED to generate ${persona}/${state.name}`); continue; }

      try {
        const count = extractAndNormalize(sheetPath, framesDir);
        console.log(`  Extracted ${count} frames to ${framesDir}`);
      } catch (e) {
        console.log(`  Extract failed: ${e.message?.slice(0, 100)}`);
        fs.mkdirSync(framesDir, { recursive: true });
        execSync(`magick "${sheetPath}" -fuzz 25% -transparent black -resize 128x128 -background none -gravity center -extent 128x128 "${framesDir}/1.png"`);
        for (let i = 2; i <= 4; i++) fs.copyFileSync(`${framesDir}/1.png`, `${framesDir}/${i}.png`);
        console.log(`  Fallback: used single frame x4`);
      }
    }
  }

  console.log("\n=== ALL DONE ===");
}

main().catch(e => console.error(e));
