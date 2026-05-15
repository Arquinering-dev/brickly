import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../prisma/client";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email y contraseña son requeridos" });
      return;
    }
    const usuario = await prisma.usuario.findUnique({
      where: { email: (email as string).toLowerCase().trim() },
    });
    if (!usuario || !usuario.activo) {
      res.status(401).json({ error: "Credenciales incorrectas" });
      return;
    }
    const valid = await bcrypt.compare(password as string, usuario.password);
    if (!valid) {
      res.status(401).json({ error: "Credenciales incorrectas" });
      return;
    }
    const token = jwt.sign(
      { sub: usuario.id, email: usuario.email, nombre: usuario.nombre },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" }
    );
    res.json({
      token,
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre },
    });
  } catch {
    res.status(500).json({ error: "Error interno" });
  }
});

router.get("/me", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: req.usuarioId },
      select: { id: true, email: true, nombre: true, activo: true },
    });
    if (!usuario || !usuario.activo) {
      res.status(401).json({ error: "No autorizado" });
      return;
    }
    res.json(usuario);
  } catch {
    res.status(500).json({ error: "Error interno" });
  }
});

export default router;
