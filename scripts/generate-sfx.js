#!/usr/bin/env node
/**
 * Generate UI sound effects using ElevenLabs SFX API.
 *
 * Usage:
 *   node generate-sfx.js <prompt> <output.mp3> [--duration <seconds>]
 *
 * Examples:
 *   node generate-sfx.js "soft magical chime, UI connect sound" connect.mp3
 *   node generate-sfx.js "gentle scroll whoosh" scroll.mp3 --duration 0.6
 *
 * Env: ELEVENLABS_API_KEY
 */

const fs = require("fs");
const https = require("https");

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) { console.error("Set ELEVENLABS_API_KEY env var"); process.exit(1); }

function generate(prompt, duration, outputPath) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text: prompt,
      duration_seconds: duration,
      prompt_influence: 0.7,
    });
    const req = https.request({
      hostname: "api.elevenlabs.io",
      path: "/v1/sound-generation",
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const buf = Buffer.concat(chunks);
        if (res.statusCode !== 200) {
          console.error(`Error ${res.statusCode}: ${buf.toString().slice(0, 200)}`);
          reject(new Error("Generation failed"));
          return;
        }
        fs.writeFileSync(outputPath, buf);
        console.log(`Saved: ${outputPath} (${buf.length} bytes)`);
        resolve();
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

const args = process.argv.slice(2);
const durIdx = args.indexOf("--duration");
let duration = 0.5;
if (durIdx !== -1) {
  duration = parseFloat(args[durIdx + 1]);
  args.splice(durIdx, 2);
}
duration = Math.max(0.5, Math.min(30, duration));

const [prompt, output] = args;
if (!prompt || !output) {
  console.error("Usage: generate-sfx.js <prompt> <output.mp3> [--duration <s>]");
  process.exit(1);
}

generate(prompt, duration, output).catch((e) => { console.error(e.message); process.exit(1); });
