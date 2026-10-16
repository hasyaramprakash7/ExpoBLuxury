// src/utils/localEmbeddings.ts
// ⚡ LOCAL AI — runs Xenova/all-MiniLM-L6-v2 entirely on-device.
//   The 70MB model is downloaded once and cached by the runtime.
//   No network calls for inference. No GPU. No server cost.

import { env, pipeline } from '@xenova/transformers';

// Cache the model in app documents so it survives restarts.
env.cacheDir = 'models';
env.allowLocalModels = true;
env.allowRemoteModels = true;

export const EMBEDDING_MODEL_ID = 'Xenova/all-MiniLM-L6-v2';
export const EMBEDDING_DIM = 384;

type FeatureExtractor = (
  text: string,
  opts: { pooling: 'mean'; normalize: boolean }
) => Promise<{ data: Float32Array | number[] }>;

let extractorPromise: Promise<FeatureExtractor> | null = null;

export const getExtractor = (): Promise<FeatureExtractor> => {
  if (!extractorPromise) {
    extractorPromise = pipeline(
      'feature-extraction',
      EMBEDDING_MODEL_ID
    ) as unknown as Promise<FeatureExtractor>;
  }
  return extractorPromise;
};

// Warm the model up on app start (non-blocking).
export const warmUpEmbeddings = () => {
  getExtractor().catch((e) =>
    console.warn('[localEmbeddings] warm-up failed:', e)
  );
};

// Turn arbitrary text into a normalized 384-dim vector.
export const embed = async (text: string): Promise<number[]> => {
  const clean = (text || '').trim();
  if (!clean) return [];
  const extractor = await getExtractor();
  const out = await extractor(clean, { pooling: 'mean', normalize: true });
  const arr =
    out.data instanceof Float32Array ? Array.from(out.data) : out.data;
  return arr as number[];
};

// Cosine similarity for two already-normalized vectors == dot product.
export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (!a.length || !b.length) return 0;
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
};

export type Rankable = { embedding?: number[] };

// Rank a list of ads by similarity to a query embedding.
// Ads without embeddings are pushed to the end (kept, never hidden).
export const rankByEmbedding = <T extends Rankable>(
  items: T[],
  queryEmbedding: number[]
): T[] => {
  if (!queryEmbedding.length) return items;
  return [...items]
    .map((item) => ({
      item,
      score:
        Array.isArray(item.embedding) && item.embedding.length
          ? cosineSimilarity(queryEmbedding, item.embedding)
          : -1,
    }))
    .sort((x, y) => y.score - x.score)
    .map((x) => x.item);
};