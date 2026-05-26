-- AlterTable
ALTER TABLE "Insumo" ADD COLUMN     "fuenteCategoria" TEXT;

-- AlterTable
ALTER TABLE "LineaPresupuesto" ADD COLUMN     "rubroNormalizado" BOOLEAN NOT NULL DEFAULT false;
