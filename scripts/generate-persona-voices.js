#!/usr/bin/env node
/**
 * Generate persona voice clips using Gemini Live API.
 *
 * Connects to the Live WebSocket with each persona's voice,
 * sends a text prompt to get a short in-character greeting,
 * captures the PCM audio response, and saves as WAV.
 *
 * Usage:
 *   GEMINI_API_KEY=AIza... node generate-persona-voices.js
 */

const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) { console.error("Set GEMINI_API_KEY env var"); process.exit(1); }

const MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
const WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${API_KEY}`;
const OUTPUT_DIR = path.join(__dirname, "..", "extension", "assets", "sfx");

const PERSONAS = [
  {
    id: "default",
    voice: "Kore",
    system: "You're Phantom — a small, curious, friendly spirit. Be warm, cute, and brief.",
    text: "Say a very short cute greeting introducing yourself as Phantom. Just 3-5 words max, like 'Hey! I'm Phantom!' Be cheerful and sweet. Only say the greeting, nothing else.",
  },
  {
    id: "detective",
    voice: "Charon",
    system: "You're Sleuth — a sharp-eyed detective spirit. Dramatic, methodical, noir detective vibes.",
    text: "Say a very short detective-style intro, like 'The name's Sleuth.' in a dramatic noir way. 3-5 words max. Only say the intro, nothing else.",
  },
  {
    id: "royal",
    voice: "Orus",
    system: "You're Regent — a dignified, regal spirit. Graceful, authoritative, polite.",
    text: "Say a very short regal greeting like 'At your service.' in a dignified royal way. 3-5 words max. Only say the greeting, nothing else.",
  },
  {
    id: "nerd",
    voice: "Puck",
    system: "You're Byte — an enthusiastic nerdy spirit. Excited about everything, upbeat.",
    text: "Say a very short nerdy excited greeting like 'Ooh, hello there!' with genuine enthusiasm. 3-5 words max. Only say the greeting, nothing else.",
  },
  {
    id: "pirate",
    voice: "Fenrir",
    system: "You're Captain — a swashbuckling pirate spirit. Bold, adventurous, always in character.",
    text: "Say a very short pirate greeting like 'Ahoy, matey!' in a bold pirate voice. 3-5 words max. Only say the greeting, nothing else.",
  },
  {
    id: "chill",
    voice: "Aoede",
    system: "You're Vibe — a supremely chill, laid-back spirit. Relaxed, breezy, zero stress.",
    text: "Say a very short chill greeting like 'Heyyy, what's up.' in the most relaxed, laid-back way. 3-5 words max. Only say the greeting, nothing else.",
  },
  {
    id: "wizard",
    voice: "Zephyr",
    system: "You're Arcane — a mystical wizard spirit. Mysterious, magical, playful.",
    text: "Say a very short mystical wizard greeting like 'Behold... I am Arcane.' in a mysterious magical way. 3-5 words max. Only say the greeting, nothing else.",
  },
  {
    id: "chaos",
    voice: "Leda",
    system: "You're Gremlin — a mischievous chaotic spirit. Excitable, a little unhinged, energetic.",
    text: "Say a very short chaotic excited greeting like 'Hehe, let's go!' with mischievous chaotic energy. 3-5 words max. Only say the greeting, nothing else.",
  },
];

function pcmToWav(pcmData, sampleRate = 24000, channels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const dataSize = pcmData.length;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmData.copy(buffer, 44);

  return buffer;
}

function generateVoiceClip(persona) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error(`Timeout for ${persona.id}`));
    }, 30000);

    const audioChunks = [];
    let setupDone = false;

    console.log(`  [${persona.id}] Connecting with voice ${persona.voice}...`);
    const ws = new WebSocket(WS_URL);

    ws.on("open", () => {
      const setup = {
        setup: {
          model: `models/${MODEL}`,
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: persona.voice },
              },
            },
          },
          systemInstruction: {
            parts: [{ text: persona.system }],
          },
        },
      };
      ws.send(JSON.stringify(setup));
    });

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.setupComplete) {
          setupDone = true;
          console.log(`  [${persona.id}] Connected. Sending prompt...`);
          ws.send(JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: persona.text }] }],
              turnComplete: true,
            },
          }));
        }

        if (msg.serverContent?.modelTurn?.parts) {
          for (const part of msg.serverContent.modelTurn.parts) {
            if (part.inlineData?.data) {
              audioChunks.push(Buffer.from(part.inlineData.data, "base64"));
            }
          }
        }

        if (msg.serverContent?.turnComplete) {
          clearTimeout(timeout);
          ws.close();

          if (audioChunks.length === 0) {
            reject(new Error(`No audio received for ${persona.id}`));
            return;
          }

          const pcm = Buffer.concat(audioChunks);
          const wav = pcmToWav(pcm);
          const outPath = path.join(OUTPUT_DIR, `persona_${persona.id}.wav`);
          fs.writeFileSync(outPath, wav);
          console.log(`  [${persona.id}] Saved ${outPath} (${wav.length} bytes, ${(pcm.length / 24000 / 2).toFixed(1)}s)`);
          resolve();
        }
      } catch (e) {
        // ignore parse errors
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ws.on("close", () => {
      clearTimeout(timeout);
    });
  });
}

async function main() {
  console.log(`Generating ${PERSONAS.length} persona voice clips...\n`);

  for (const persona of PERSONAS) {
    try {
      await generateVoiceClip(persona);
    } catch (err) {
      console.error(`  [${persona.id}] FAILED: ${err.message}`);
    }
    // Small delay between connections
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\nDone!");
}

main();
