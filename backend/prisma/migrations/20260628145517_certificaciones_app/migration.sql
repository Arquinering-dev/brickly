-- AlterTable
ALTER TABLE "Certificacion" ADD COLUMN     "fuente" TEXT NOT NULL DEFAULT 'import',
ADD COLUMN     "nota" TEXT,
ADD COLUMN     "periodoAnio" INTEGER,
ADD COLUMN     "periodoMes" INTEGER;

-- AlterTable
ALTER TABLE "CertificacionLinea" ADD COLUMN     "descripcion" TEXT,
ADD COLUMN     "lineaId" TEXT;

-- AlterTable
ALTER TABLE "ContratoCliente" ADD COLUMN     "fuente" TEXT NOT NULL DEFAULT 'import';

-- CreateIndex
CREATE INDEX "CertificacionLinea_lineaId_idx" ON "CertificacionLinea"("lineaId");

-- AddForeignKey
ALTER TABLE "CertificacionLinea" ADD CONSTRAINT "CertificacionLinea_lineaId_fkey" FOREIGN KEY ("lineaId") REFERENCES "LineaPresupuesto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
