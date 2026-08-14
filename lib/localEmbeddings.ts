import { pipeline } from "@xenova/transformers";

// Cache pipeline instance across requests
let extractor: any = null;

async function getExtractor() {
  if (!extractor) {
    // Loads lightweight, open-source MiniLM embeddings model locally
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
}

/**
 * Calculates cosine similarity between two numeric vectors
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Compares two descriptions locally and returns a similarity score (0.0 to 1.0)
 */
export async function compareIssueTexts(text1: string, text2: string): Promise<number> {
  try {
    const pipe = await getExtractor();
    const output1 = await pipe(text1, { pooling: "mean", normalize: true });
    const output2 = await pipe(text2, { pooling: "mean", normalize: true });

    const embedding1 = Array.from(output1.data as Float32Array);
    const embedding2 = Array.from(output2.data as Float32Array);

    return cosineSimilarity(embedding1, embedding2);
  } catch (err) {
    console.warn("Local embedding calculation fallback:", err);
    return 0.8; // Fallback: allow spatial proximity to take precedence
  }
}