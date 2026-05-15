import { createContext, useContext, useState, ReactNode } from "react";

interface Usuario {
  id: string;
  email: string;
  nombre?: string | null;
}

interface AuthContextType {
  usuario: Usuario | null;
  token: string | null;
  login: (token: string, usuario: Usuario) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("brickly_token")
  );
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const raw = localStorage.getItem("brickly_user");
    return raw ? (JSON.parse(raw) as Usuario) : null;
  });

  const login = (newToken: string, newUsuario: Usuario) => {
    localStorage.setItem("brickly_token", newToken);
    localStorage.setItem("brickly_user", JSON.stringify(newUsuario));
    setToken(newToken);
    setUsuario(newUsuario);
  };

  const logout = () => {
    localStorage.removeItem("brickly_token");
    localStorage.removeItem("brickly_user");
    setToken(null);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
