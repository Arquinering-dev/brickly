-- CreateEnum
CREATE TYPE "TipoInsumo" AS ENUM ('MATERIAL', 'MANO_DE_OBRA', 'EQUIPO', 'SUBCONTRATO');

-- CreateEnum
CREATE TYPE "TipoPartida" AS ENUM ('APU', 'SUBCONTRATO', 'COTIZACION_DIRECTA');

-- CreateEnum
CREATE TYPE "EstadoObra" AS ENUM ('EN_PRESUPUESTO', 'EN_CURSO', 'FINALIZADA');

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "tipo" "TipoInsumo" NOT NULL,
    "unidad" TEXT NOT NULL,
    "precioReferencia" DECIMAL(18,2) NOT NULL,
    "proveedor" TEXT,
    "categoria" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partida" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "rubro" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "rendimiento" DECIMAL(10,4),
    "tipo" "TipoPartida" NOT NULL DEFAULT 'APU',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Composicion" (
    "id" TEXT NOT NULL,
    "partidaId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "cantidadPorUnidad" DECIMAL(14,6) NOT NULL,
    "pctDesperdicio" DECIMAL(6,4) NOT NULL,
    "secuencia" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Composicion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3),
    "estado" "EstadoObra" NOT NULL DEFAULT 'EN_PRESUPUESTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Obra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresupuestoHeader" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "cacValor" DECIMAL(12,2) NOT NULL,
    "mesCac" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'vigente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PresupuestoHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineaPresupuesto" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "presupuestoHeaderId" TEXT NOT NULL,
    "partidaId" TEXT,
    "cantidad" DECIMAL(14,4) NOT NULL,
    "precioUnitarioSnapshot" DECIMAL(18,2) NOT NULL,
    "tipo" "TipoPartida" NOT NULL DEFAULT 'APU',
    "descripcionLibre" TEXT,
    "estadoItem" TEXT NOT NULL DEFAULT 'OK',
    "rubro" TEXT NOT NULL,
    "subRubro" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineaPresupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Insumo_codigo_key" ON "Insumo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Partida_codigo_key" ON "Partida"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Obra_codigo_key" ON "Obra"("codigo");

-- AddForeignKey
ALTER TABLE "Composicion" ADD CONSTRAINT "Composicion_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Composicion" ADD CONSTRAINT "Composicion_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresupuestoHeader" ADD CONSTRAINT "PresupuestoHeader_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaPresupuesto" ADD CONSTRAINT "LineaPresupuesto_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaPresupuesto" ADD CONSTRAINT "LineaPresupuesto_presupuestoHeaderId_fkey" FOREIGN KEY ("presupuestoHeaderId") REFERENCES "PresupuestoHeader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineaPresupuesto" ADD CONSTRAINT "LineaPresupuesto_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida"("id") ON DELETE SET NULL ON UPDATE CASCADE;
