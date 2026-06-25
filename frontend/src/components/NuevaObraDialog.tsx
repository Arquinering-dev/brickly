import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "./ui/dialog";
import { Input, Label } from "./ui/input";
import { Button } from "./ui/button";

interface Obra {
  id: string;
  nombre: string;
  codigo: string;
}

const ESTADOS: { value: string; label: string }[] = [
  { value: "EN_PRESUPUESTO", label: "En presupuesto" },
  { value: "EN_CURSO", label: "En curso" },
  { value: "FINALIZADA", label: "Finalizada" },
];

export function NuevaObraDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (obra: Obra) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [codigo, setCodigo] = useState("");
  const [estado, setEstado] = useState("EN_PRESUPUESTO");
  const [fechaInicio, setFechaInicio] = useState("");
  const [centroCosto, setCentroCosto] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setNombre(""); setCodigo(""); setEstado("EN_PRESUPUESTO");
    setFechaInicio(""); setCentroCosto(""); setSaving(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !codigo.trim()) {
      toast.error("Nombre y código son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/api/obras", {
        method: "POST",
        body: JSON.stringify({
          nombre: nombre.trim(),
          codigo: codigo.trim(),
          estado,
          fechaInicio: fechaInicio || undefined,
          centroCosto: centroCosto.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "No se pudo crear la obra");
        setSaving(false);
        return;
      }
      toast.success("Obra creada — ahora importá el Resumen de Obra para completar los datos");
      reset();
      onOpenChange(false);
      onCreated(data as Obra);
    } catch {
      toast.error("No se pudo conectar con el servidor");
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) { onOpenChange(v); if (!v) reset(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva obra</DialogTitle>
          <DialogDescription>
            Creá la obra con los datos básicos. El presupuesto, los insumos y los KPIs se completan
            después importando el Resumen de Obra.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="obra-nombre">Nombre *</Label>
            <Input
              id="obra-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Edificio Chivilcoy 2171"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="obra-codigo">Código *</Label>
              <Input
                id="obra-codigo"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ej: CH2171"
                className="font-mono uppercase"
              />
              <p className="text-2xs text-stone-400">Idealmente igual al del archivo (CH_2171… → CH2171).</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obra-estado">Estado</Label>
              <select
                id="obra-estado"
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {ESTADOS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="obra-fecha">Fecha de inicio</Label>
              <Input
                id="obra-fecha"
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obra-cc">Centro de costo</Label>
              <Input
                id="obra-cc"
                value={centroCosto}
                onChange={(e) => setCentroCosto(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Crear obra
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
