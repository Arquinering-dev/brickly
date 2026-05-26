-- CreateEnum
CREATE TYPE "ScopePartida" AS ENUM ('APU', 'OBRA');

-- CreateEnum
CREATE TYPE "TipoPresupuesto" AS ENUM ('GENERADOR', 'APROBADO');

-- AlterTable
ALTER TABLE "Partida" ADD COLUMN     "obraId" TEXT,
ADD COLUMN     "scope" "ScopePartida" NOT NULL DEFAULT 'APU';

-- AlterTable
ALTER TABLE "PresupuestoHeader" ADD COLUMN     "tipo" "TipoPresupuesto" NOT NULL DEFAULT 'GENERADOR';

-- CreateTable
CREATE TABLE "Planificacion" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "duracionMeses" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'borrador',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanificacionFila" (
    "id" TEXT NOT NULL,
    "planificacionId" TEXT NOT NULL,
    "lineaId" TEXT,
    "partidaId" TEXT,
    "itemNumero" TEXT,
    "rubro" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "cantidad" DECIMAL(14,4) NOT NULL,
    "pctPorMes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanificacionFila_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Planificacion_obraId_idx" ON "Planificacion"("obraId");

-- CreateIndex
CREATE INDEX "PlanificacionFila_planificacionId_idx" ON "PlanificacionFila"("planificacionId");

-- CreateIndex
CREATE INDEX "Partida_scope_obraId_idx" ON "Partida"("scope", "obraId");

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planificacion" ADD CONSTRAINT "Planificacion_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanificacionFila" ADD CONSTRAINT "PlanificacionFila_planificacionId_fkey" FOREIGN KEY ("planificacionId") REFERENCES "Planificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
