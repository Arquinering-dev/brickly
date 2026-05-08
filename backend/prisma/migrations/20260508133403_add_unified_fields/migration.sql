-- AlterTable
ALTER TABLE "Insumo" ADD COLUMN     "codigoOriginal" TEXT,
ADD COLUMN     "fechaCotizacion" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LineaPresupuesto" ADD COLUMN     "apuLinkCodigo" TEXT,
ADD COLUMN     "eqUd" DECIMAL(18,2),
ADD COLUMN     "fuente" TEXT,
ADD COLUMN     "itemNumero" TEXT,
ADD COLUMN     "matUd" DECIMAL(18,2),
ADD COLUMN     "moUd" DECIMAL(18,2),
ADD COLUMN     "orden" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "precioVenta" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "PresupuestoHeader" ADD COLUMN     "coefGGBB" DECIMAL(8,4),
ADD COLUMN     "nombre" TEXT,
ADD COLUMN     "version" TEXT;
