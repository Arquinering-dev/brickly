const BASE = import.meta.env.VITE_API_URL ?? "";

export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = localStorage.getItem("brickly_token");
  const isFormData = options?.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(!isFormData && { "Content-Type": "application/json" }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options?.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    localStorage.removeItem("brickly_token");
    localStorage.removeItem("brickly_user");
    window.location.href = "/login";
  }

  return res;
}
