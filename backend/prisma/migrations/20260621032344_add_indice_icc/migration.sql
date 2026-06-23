-- CreateTable
CREATE TABLE "IndiceICC" (
    "id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "variacionMensual" DECIMAL(8,4),
    "variacionAnual" DECIMAL(8,4),
    "fuente" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndiceICC_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IndiceICC_anio_mes_idx" ON "IndiceICC"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "IndiceICC_mes_anio_key" ON "IndiceICC"("mes", "anio");
