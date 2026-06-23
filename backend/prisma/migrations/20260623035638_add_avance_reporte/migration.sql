-- CreateTable
CREATE TABLE "AvanceReporte" (
    "id" TEXT NOT NULL,
    "lineaId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pctIncremento" DECIMAL(8,6) NOT NULL,
    "cantidad" DECIMAL(14,4),
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvanceReporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvanceReporte_lineaId_idx" ON "AvanceReporte"("lineaId");

-- AddForeignKey
ALTER TABLE "AvanceReporte" ADD CONSTRAINT "AvanceReporte_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "LineaPresupuesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
