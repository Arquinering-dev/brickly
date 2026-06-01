/**
 * Cliente Gemini mínimo (REST, sin SDK).
 *
 * Se reintrodujo IA al backend de forma acotada y SOLO en write-time (categorización de insumos
 * al importar) — NO en el hot-path por request. Si GEMINI_API_KEY no está seteada, las funciones
 * que dependen de IA hacen no-op de forma segura (el import sigue funcionando sin categorizar).
 *
 * Doc: https://ai.google.dev/api/generate-content
 */

const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

type GeminiJsonOpts = {
  /** Esquema JSON (subset OpenAPI que acepta Gemini) para forzar salida estructurada. */
  responseSchema?: Record<string, unknown>;
  /** Instrucción de sistema opcional. */
  system?: string;
  temperature?: number;
};

/**
 * Llama a generateContent y devuelve el texto crudo del modelo.
 * Lanza si no hay API key o si la API responde con error.
 */
export async function geminiGenerate(prompt: string, opts: GeminiJsonOpts = {}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY no configurada");

  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0,
      ...(opts.responseSchema
        ? { responseMimeType: "application/json", responseSchema: opts.responseSchema }
        : {}),
    },
    ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
  };

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini ${res.status}: ${txt.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error("Gemini: respuesta vacía");
  return text;
}

/** Igual que geminiGenerate pero parsea la salida como JSON (con responseSchema). */
export async function geminiGenerateJson<T = unknown>(prompt: string, opts: GeminiJsonOpts): Promise<T> {
  const raw = await geminiGenerate(prompt, opts);
  try {
    return JSON.parse(raw) as T;
  } catch {
    // A veces el modelo envuelve en ```json … ```; intentar rescatar.
    const m = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1]) as T;
    throw new Error(`Gemini: salida no es JSON válido: ${raw.slice(0, 200)}`);
  }
}
