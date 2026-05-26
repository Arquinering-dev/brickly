import { getGeminiClient, GEMINI_MODELS } from "./gemini.client";

interface GenerateJsonOptions {
  systemPrompt: string;
  userPrompt: string;
  // Schema JSON describiendo la salida esperada. Gemini hace structured output
  // y nos garantiza JSON válido si lo especificamos.
  responseSchema: object;
  // Topa la latencia/costo si el modelo divaga.
  maxOutputTokens?: number;
  temperature?: number;
}

/**
 * Genera una respuesta estructurada JSON con Gemini Flash.
 * Devuelve null si no hay API key configurada o si la llamada falla.
 * El consumidor debe validar la forma del JSON antes de usarlo.
 */
export async function generateJson<T>(opts: GenerateJsonOptions): Promise<T | null> {
  const client = getGeminiClient();
  if (!client) return null;

  try {
    const response = await client.models.generateContent({
      model: GEMINI_MODELS.flash,
      contents: opts.userPrompt,
      config: {
        systemInstruction: opts.systemPrompt,
        responseMimeType: "application/json",
        responseSchema: opts.responseSchema,
        temperature: opts.temperature ?? 0.2,
        maxOutputTokens: opts.maxOutputTokens ?? 2048,
        // gemini-2.5-flash usa thinking tokens por default; en llamadas de
        // structured output no aportan valor y consumen el budget de output.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    console.error(
      "[llm] generateJson falló:",
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
