/**
 * Local embedding model for semantic memory search.
 * Uses Xenova/transformers.js with all-MiniLM-L6-v2 (384D vectors).
 * Model is downloaded during onboarding and cached by the browser.
 */

import { pipeline, env } from "@xenova/transformers";

// Configure for browser extension environment
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
let embedderPipeline: any = null;
let isLoading = false;

export type ProgressCallback = (progress: {
  status: string;
  progress?: number;
  file?: string;
}) => void;

/**
 * Load the embedding model. Call during onboarding with a progress callback,
 * or lazily on first use.
 */
export async function loadEmbeddingModel(
  onProgress?: ProgressCallback
): Promise<void> {
  if (embedderPipeline) return;
  if (isLoading) {
    // Wait for existing load
    while (isLoading) await new Promise((r) => setTimeout(r, 100));
    return;
  }

  isLoading = true;
  try {
    console.log("[Embeddings] Loading model:", MODEL_ID);
    embedderPipeline = await pipeline("feature-extraction", MODEL_ID, {
      progress_callback: onProgress,
    });
    console.log("[Embeddings] Model loaded!");
  } finally {
    isLoading = false;
  }
}

/**
 * Check if model is loaded and ready.
 */
export function isModelReady(): boolean {
  return embedderPipeline !== null;
}

/**
 * Generate a 384-dimensional embedding for text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!embedderPipeline) await loadEmbeddingModel();
  const output = await embedderPipeline!(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(output.data as Float32Array);
}

/**
 * Cosine similarity between two vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}
