import { getGeminiClient, GEMINI_MODELS, EMBEDDING_DIM } from "./gemini.client";

// Batches del API: Gemini permite hasta 100 textos por embedContent.
const BATCH_SIZE = 100;

// Normaliza el texto para que cosine sea estable (uppercase + collapse spaces).
export function normalizeForEmbedding(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// Genera embeddings para una lista de textos. Devuelve null en posición i si
// la API falló para ese batch (no aborta toda la operación).
export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const client = getGeminiClient();
  if (!client) return texts.map(() => null);

  const results: (number[] | null)[] = new Array(texts.length).fill(null);

  for (let start = 0; start < texts.length; start += BATCH_SIZE) {
    const slice = texts.slice(start, start + BATCH_SIZE);
    try {
      const response = await client.models.embedContent({
        model: GEMINI_MODELS.embedding,
        contents: slice,
        config: {
          taskType: "SEMANTIC_SIMILARITY",
        },
      });
      const embeddings = response.embeddings ?? [];
      for (let i = 0; i < slice.length; i++) {
        const values = embeddings[i]?.values;
        if (values && values.length === EMBEDDING_DIM) {
          results[start + i] = values;
        }
      }
    } catch (err) {
      console.error(
        `[embeddings] batch ${start}-${start + slice.length} falló:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return results;
}

export async function embedText(text: string): Promise<number[] | null> {
  const [result] = await embedTexts([text]);
  return result;
}

// Cosine similarity entre dos vectores. Asume misma dimensión.
export function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
