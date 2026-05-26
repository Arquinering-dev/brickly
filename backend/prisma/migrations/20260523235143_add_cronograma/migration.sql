-- AlterTable
ALTER TABLE "PresupuestoHeader" ADD COLUMN     "fechaInicio" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LineaCronograma" (
    "id" TEXT NOT NULL,
    "lineaId" TEXT NOT NULL,
    "mesOrdinal" INTEGER NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "pctEjecucion" DECIMAL(8,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineaCronograma_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LineaCronograma_fecha_idx" ON "LineaCronograma"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "LineaCronograma_lineaId_mesOrdinal_key" ON "LineaCronograma"("lineaId", "mesOrdinal");

-- AddForeignKey
ALTER TABLE "LineaCronograma" ADD CONSTRAINT "LineaCronograma_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "LineaPresupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
