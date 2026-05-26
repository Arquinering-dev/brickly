-- AlterTable
ALTER TABLE "Insumo" ADD COLUMN     "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
ADD COLUMN     "embeddingSource" TEXT,
ADD COLUMN     "embeddingUpdatedAt" TIMESTAMP(3);
