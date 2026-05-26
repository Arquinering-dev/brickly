import { GoogleGenAI } from "@google/genai";

// Modelos canónicos del proyecto. Cambiar acá para upgrades.
export const GEMINI_MODELS = {
  // LLM rápido y barato para validación y razonamiento liviano
  flash: "gemini-2.5-flash",
  // Embeddings semánticos. 768 dims, free tier holgado.
  embedding: "text-embedding-004",
} as const;

// Dimensión del vector que devuelve text-embedding-004.
export const EMBEDDING_DIM = 768;

let cachedClient: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) {
    cachedClient = new GoogleGenAI({ apiKey });
  }
  return cachedClient;
}

export function isGeminiEnabled(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
