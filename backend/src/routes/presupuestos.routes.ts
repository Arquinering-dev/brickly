import { Router, Request, Response } from "express";
import multer from "multer";
import prisma from "../prisma/client";
import { parsePresupuestoXlsx } from "../services/presupuesto-parser.service";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// POST /api/presupuestos/parse-xlsx
// multipart/form-data: file=archivo.xlsx, tipo? (GENERADOR|APROBADO)
// Devuelve un preview sin persistir.
router.post("/parse-xlsx", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No se recibió ningún archivo" });
      return;
    }
    const tipo = (req.body?.tipo === "APROBADO" ? "APROBADO" : "GENERADOR") as "GENERADOR" | "APROBADO";
    const preview = await parsePresupuestoXlsx(req.file.buffer, { tipo });
    res.json(preview);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al parsear archivo" });
  }
});

// POST /api/presupuestos/confirmar-import
// Body: { tipo, obraId?, obraNombre?, obraCodigo?, nombre?, version?, mesCac?, cacValor?, lineas: [...] }
// Crea obra si no existe, crea PresupuestoHeader, persiste líneas y (si aprobado) cronograma.
router.post("/confirmar-import", async (req: Request, res: Response) => {
  try {
    const {
      tipo = "GENERADOR",
      obraId,
      obraNombre,
      obraCodigo,
      nombre,
      version,
      mesCac = "",
      cacValor = 0,
      coefGGBB,
      fechaInicio,
      lineas = [],
      cronogramaMeses = [],
    } = req.body as {
      tipo?: "GENERADOR" | "APROBADO";
      obraId?: string;
      obraNombre?: string;
      obraCodigo?: string;
      nombre?: string;
      version?: string;
      mesCac?: string;
      cacValor?: number;
      coefGGBB?: number;
      fechaInicio?: string;
      lineas: Array<{
        itemNumero: string | null;
        descripcion: string;
        unidad: string;
        cantidad: number;
        matUd: number;
        moUd: number;
        eqUd: number;
        precioUnitario: number;
        precioVenta: number | null;
        rubro: string;
        isRubroRow: boolean;
        cronograma?: number[];
        partidaId?: string | null;
        crearPartidaObra?: boolean;
      }>;
      cronogramaMeses?: { mesOrdinal: number; fecha: string | null }[];
    };

    // 1) Obra
    let obra = obraId
      ? await prisma.obra.findUnique({ where: { id: obraId } })
      : null;
    if (!obra) {
      if (!obraNombre || !obraCodigo) {
        res.status(400).json({ error: "Falta obraId o (obraNombre + obraCodigo)" });
        return;
      }
      // Buscar por código
      obra = await prisma.obra.findUnique({ where: { codigo: obraCodigo } });
      if (!obra) {
        obra = await prisma.obra.create({
          data: { nombre: obraNombre, codigo: obraCodigo, estado: "EN_PRESUPUESTO" },
        });
      }
    }

    // 2) Header
    const header = await prisma.presupuestoHeader.create({
      data: {
        obraId: obra.id,
        tipo,
        nombre: nombre ?? null,
        version: version ?? null,
        mesCac,
        cacValor,
        coefGGBB: coefGGBB ?? null,
        fecha: new Date(),
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      },
    });

    // 3) Líneas (saltea rubro rows; solo persiste tareas reales)
    const tareas = lineas.filter((l) => !l.isRubroRow);

    // 3a) Resolver partidaId — si vino crearPartidaObra, crear nueva con scope=OBRA
    const lineasResueltas: Array<{
      partidaId: string | null;
      cantidad: number;
      precioUnit: number;
      precioVenta: number | null;
      rubro: string;
      itemNumero: string | null;
      descripcion: string;
      orden: number;
      matUd: number;
      moUd: number;
      eqUd: number;
      cronograma?: number[];
    }> = [];

    for (let i = 0; i < tareas.length; i++) {
      const l = tareas[i];
      let partidaId: string | null = l.partidaId ?? null;
      if (!partidaId && l.crearPartidaObra) {
        const nueva = await prisma.partida.create({
          data: {
            codigo: `PO-${obra.codigo}-${Date.now().toString(36)}-${i}`,
            descripcion: l.descripcion,
            rubro: l.rubro,
            unidad: l.unidad || "u",
            tipo: "APU",
            scope: "OBRA",
            obraId: obra.id,
          },
        });
        partidaId = nueva.id;
      }
      lineasResueltas.push({
        partidaId,
        cantidad: l.cantidad,
        precioUnit: l.precioUnitario,
        precioVenta: l.precioVenta,
        rubro: l.rubro,
        itemNumero: l.itemNumero,
        descripcion: l.descripcion,
        orden: i,
        matUd: l.matUd,
        moUd: l.moUd,
        eqUd: l.eqUd,
        cronograma: l.cronograma,
      });
    }

    // 3b) Crear líneas
    const createdLineas = await Promise.all(
      lineasResueltas.map((l) =>
        prisma.lineaPresupuesto.create({
          data: {
            obraId: obra!.id,
            presupuestoHeaderId: header.id,
            partidaId: l.partidaId,
            cantidad: l.cantidad,
            precioUnitarioSnapshot: l.precioUnit,
            precioVenta: l.precioVenta,
            rubro: l.rubro,
            itemNumero: l.itemNumero,
            orden: l.orden,
            descripcionLibre: l.partidaId ? null : l.descripcion,
            tipo: "APU",
            matUd: l.matUd || null,
            moUd: l.moUd || null,
            eqUd: l.eqUd || null,
          },
        })
      )
    );

    // 4) Cronograma (solo si aprobado y hay datos)
    if (tipo === "APROBADO" && cronogramaMeses.length > 0) {
      const cronRows: { lineaId: string; mesOrdinal: number; fecha: Date; pctEjecucion: number }[] = [];
      for (let i = 0; i < createdLineas.length; i++) {
        const linea = createdLineas[i];
        const cron = lineasResueltas[i].cronograma;
        if (!cron || cron.length === 0) continue;
        for (let j = 0; j < cron.length; j++) {
          if (cron[j] > 0 && cronogramaMeses[j]) {
            cronRows.push({
              lineaId: linea.id,
              mesOrdinal: cronogramaMeses[j].mesOrdinal,
              fecha: cronogramaMeses[j].fecha ? new Date(cronogramaMeses[j].fecha!) : new Date(),
              pctEjecucion: cron[j],
            });
          }
        }
      }
      if (cronRows.length > 0) {
        await prisma.lineaCronograma.createMany({ data: cronRows });
      }
      // Setear fechaInicio del header al primer mes
      const primerMes = cronogramaMeses.find((m) => m.fecha);
      if (primerMes?.fecha) {
        await prisma.presupuestoHeader.update({
          where: { id: header.id },
          data: { fechaInicio: new Date(primerMes.fecha) },
        });
      }
    }

    res.status(201).json({
      ok: true,
      header,
      obra,
      lineasCount: createdLineas.length,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al confirmar import" });
  }
});

// Lista resumen de todos los presupuestos (generador + aprobado)
router.get("/", async (req: Request, res: Response) => {
  try {
    const tipo = req.query.tipo as string | undefined;
    const obraId = req.query.obraId as string | undefined;

    const headers = await prisma.presupuestoHeader.findMany({
      where: {
        ...(tipo ? { tipo: tipo as "GENERADOR" | "APROBADO" } : {}),
        ...(obraId ? { obraId } : {}),
      },
      include: {
        obra: { select: { id: true, nombre: true, codigo: true, estado: true } },
        _count: { select: { lineas: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const enriched = await Promise.all(
      headers.map(async (h) => {
        const agg = await prisma.lineaPresupuesto.aggregate({
          where: { presupuestoHeaderId: h.id },
          _count: { id: true },
        });
        const lineas = await prisma.lineaPresupuesto.findMany({
          where: { presupuestoHeaderId: h.id },
          select: { cantidad: true, precioUnitarioSnapshot: true, precioVenta: true, rubro: true },
        });
        let totalCD = 0;
        let totalPV = 0;
        const rubrosSet = new Set<string>();
        for (const l of lineas) {
          totalCD += Number(l.precioUnitarioSnapshot) * Number(l.cantidad);
          totalPV += Number(l.precioVenta ?? 0) * Number(l.cantidad);
          if (l.rubro) rubrosSet.add(l.rubro);
        }
        return {
          id: h.id,
          obra: h.obra,
          tipo: h.tipo,
          nombre: h.nombre,
          version: h.version,
          estado: h.estado,
          mesCac: h.mesCac,
          cacValor: Number(h.cacValor),
          coefGGBB: h.coefGGBB ? Number(h.coefGGBB) : null,
          fecha: h.fecha,
          fechaInicio: h.fechaInicio,
          lineasCount: agg._count.id,
          rubrosCount: rubrosSet.size,
          totalCD,
          totalPV,
          createdAt: h.createdAt,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al listar presupuestos" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const header = await prisma.presupuestoHeader.findUnique({
      where: { id: req.params.id },
      include: {
        obra: true,
        lineas: {
          include: {
            partida: { include: { composiciones: { include: { insumo: true }, orderBy: { secuencia: "asc" } } } },
            cronograma: { orderBy: { mesOrdinal: "asc" } },
          },
          orderBy: { orden: "asc" },
        },
      },
    });
    if (!header) {
      res.status(404).json({ error: "Presupuesto no encontrado" });
      return;
    }
    res.json(header);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al obtener presupuesto" });
  }
});

// Crear un presupuesto vacío (luego se le agregan líneas)
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      obraId, tipo = "GENERADOR", nombre, version, mesCac = "",
      cacValor = 0, coefGGBB, fecha, fechaInicio,
    } = req.body as {
      obraId: string;
      tipo?: "GENERADOR" | "APROBADO";
      nombre?: string;
      version?: string;
      mesCac?: string;
      cacValor?: number;
      coefGGBB?: number;
      fecha?: string;
      fechaInicio?: string;
    };
    if (!obraId) {
      res.status(400).json({ error: "obraId es requerido" });
      return;
    }
    const header = await prisma.presupuestoHeader.create({
      data: {
        obraId,
        tipo,
        nombre: nombre ?? null,
        version: version ?? null,
        mesCac,
        cacValor,
        coefGGBB: coefGGBB ?? null,
        fecha: fecha ? new Date(fecha) : new Date(),
        fechaInicio: fechaInicio ? new Date(fechaInicio) : null,
      },
    });
    res.status(201).json(header);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al crear presupuesto" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const { nombre, version, mesCac, cacValor, coefGGBB, estado, fechaInicio } = req.body;
    const header = await prisma.presupuestoHeader.update({
      where: { id: req.params.id },
      data: {
        ...(nombre !== undefined && { nombre }),
        ...(version !== undefined && { version }),
        ...(mesCac !== undefined && { mesCac }),
        ...(cacValor !== undefined && { cacValor }),
        ...(coefGGBB !== undefined && { coefGGBB }),
        ...(estado !== undefined && { estado }),
        ...(fechaInicio !== undefined && { fechaInicio: fechaInicio ? new Date(fechaInicio) : null }),
      },
    });
    res.json(header);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al actualizar presupuesto" });
  }
});

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    await prisma.$transaction([
      prisma.lineaCronograma.deleteMany({
        where: { linea: { presupuestoHeaderId: req.params.id } },
      }),
      prisma.lineaPresupuesto.deleteMany({ where: { presupuestoHeaderId: req.params.id } }),
      prisma.presupuestoHeader.delete({ where: { id: req.params.id } }),
    ]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al eliminar presupuesto" });
  }
});

// Reemplazar todas las líneas del presupuesto en un solo POST (bulk)
router.put("/:id/lineas", async (req: Request, res: Response) => {
  try {
    const headerId = req.params.id;
    const { lineas } = req.body as {
      lineas: Array<{
        partidaId?: string | null;
        cantidad: number;
        precioUnitarioSnapshot: number;
        precioVenta?: number | null;
        rubro: string;
        subRubro?: string | null;
        itemNumero?: string | null;
        orden?: number;
        descripcionLibre?: string | null;
        tipo?: "APU" | "SUBCONTRATO" | "COTIZACION_DIRECTA";
        matUd?: number | null;
        moUd?: number | null;
        eqUd?: number | null;
        fuente?: string | null;
        apuLinkCodigo?: string | null;
      }>;
    };
    if (!Array.isArray(lineas)) {
      res.status(400).json({ error: "lineas es requerido" });
      return;
    }

    const header = await prisma.presupuestoHeader.findUnique({ where: { id: headerId } });
    if (!header) {
      res.status(404).json({ error: "Presupuesto no encontrado" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.lineaCronograma.deleteMany({ where: { linea: { presupuestoHeaderId: headerId } } });
      await tx.lineaPresupuesto.deleteMany({ where: { presupuestoHeaderId: headerId } });
      if (lineas.length > 0) {
        await tx.lineaPresupuesto.createMany({
          data: lineas.map((l, idx) => ({
            obraId: header.obraId,
            presupuestoHeaderId: headerId,
            partidaId: l.partidaId ?? null,
            cantidad: l.cantidad,
            precioUnitarioSnapshot: l.precioUnitarioSnapshot,
            precioVenta: l.precioVenta ?? null,
            rubro: l.rubro,
            subRubro: l.subRubro ?? null,
            itemNumero: l.itemNumero ?? null,
            orden: l.orden ?? idx,
            descripcionLibre: l.descripcionLibre ?? null,
            tipo: l.tipo ?? "APU",
            matUd: l.matUd ?? null,
            moUd: l.moUd ?? null,
            eqUd: l.eqUd ?? null,
            fuente: l.fuente ?? null,
            apuLinkCodigo: l.apuLinkCodigo ?? null,
          })),
        });
      }
    });

    res.json({ ok: true, count: lineas.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Error al guardar líneas" });
  }
});

export default router;
