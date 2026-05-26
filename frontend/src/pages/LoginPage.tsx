import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { HardHat } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input, Label } from "../components/ui/input";

const BASE = import.meta.env.VITE_API_URL ?? "";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
      }
      login(data.token, data.usuario);
      navigate("/", { replace: true });
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-stone-50 to-brand-100/40 flex items-center justify-center px-4 relative overflow-hidden">
      {/* Decorative shapes */}
      <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-brand-200/30 blur-3xl" />
      <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand-300/20 blur-3xl" />

      <div className="w-full max-w-sm relative">
        <div className="bg-white rounded-3xl shadow-lg border border-stone-200/70 p-8 backdrop-blur-sm">
          <div className="flex flex-col items-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-brand-600 to-brand-900 grid place-items-center mb-4 shadow-md shadow-brand-900/20">
              <HardHat className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-black text-stone-900 tracking-tight">Groundwork</h1>
            <p className="text-xs text-stone-500 mt-1">Arquinering · Control de Obra</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                placeholder="usuario@empresa.com"
              />
            </div>
            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-xs text-danger-700 bg-danger-50 border border-danger-100 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? "Ingresando…" : "Ingresar"}
            </Button>
          </form>
        </div>
        <p className="text-center text-2xs text-stone-400 mt-6 tracking-wider">
          ARQUINERING S.R.L.
        </p>
      </div>
    </div>
  );
}
