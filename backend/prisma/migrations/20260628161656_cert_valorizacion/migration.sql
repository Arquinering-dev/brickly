-- AlterTable
ALTER TABLE "Certificacion" ADD COLUMN     "indiceCacBase" DECIMAL(16,4),
ADD COLUMN     "indiceCacFecha" DECIMAL(16,4),
ADD COLUMN     "pctFacturable" DECIMAL(6,4),
ADD COLUMN     "pctIva" DECIMAL(6,4);
