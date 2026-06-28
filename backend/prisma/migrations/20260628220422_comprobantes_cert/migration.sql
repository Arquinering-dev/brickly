-- CreateTable
CREATE TABLE "ComprobanteCert" (
    "id" TEXT NOT NULL,
    "certificacionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "numero" TEXT,
    "monto" DECIMAL(18,2) NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "fechaCobro" TIMESTAMP(3),
    "retencion" DECIMAL(18,2),
    "nota" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComprobanteCert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ComprobanteCert_certificacionId_idx" ON "ComprobanteCert"("certificacionId");

-- AddForeignKey
ALTER TABLE "ComprobanteCert" ADD CONSTRAINT "ComprobanteCert_certificacionId_fkey" FOREIGN KEY ("certificacionId") REFERENCES "Certificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
