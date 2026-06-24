-- AlterTable
ALTER TABLE "LineaPresupuesto" ADD COLUMN     "costoEqUd" DECIMAL(18,2),
ADD COLUMN     "costoMoAlbUd" DECIMAL(18,2),
ADD COLUMN     "costoMoOtrUd" DECIMAL(18,2),
ADD COLUMN     "costoMtUd" DECIMAL(18,2),
ADD COLUMN     "etapa" TEXT,
ADD COLUMN     "pctCertificado" DECIMAL(8,6),
ADD COLUMN     "pvEqUd" DECIMAL(18,2),
ADD COLUMN     "pvMoAlbUd" DECIMAL(18,2),
ADD COLUMN     "pvMoOtrUd" DECIMAL(18,2),
ADD COLUMN     "pvMtUd" DECIMAL(18,2),
ADD COLUMN     "rubroMoAlb" TEXT,
ADD COLUMN     "rubroMoOtr" TEXT,
ADD COLUMN     "rubroMt" TEXT;

-- AlterTable
ALTER TABLE "Obra" ADD COLUMN     "aperturaBlancoP" DECIMAL(5,2),
ADD COLUMN     "aperturaNegrop" DECIMAL(5,2),
ADD COLUMN     "centroCosto" TEXT,
ADD COLUMN     "coefGGBB" DECIMAL(12,8),
ADD COLUMN     "costoControlable" DECIMAL(18,2),
ADD COLUMN     "mesCacBase" TEXT,
ADD COLUMN     "precioVentaTotal" DECIMAL(18,2),
ADD COLUMN     "valorCacBase" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "RubroContable" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RubroContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndiceCAC" (
    "id" TEXT NOT NULL,
    "mes" TIMESTAMP(3) NOT NULL,
    "valorIndec" DECIMAL(14,4) NOT NULL,
    "esPrevision" BOOLEAN NOT NULL DEFAULT false,
    "ratio" DECIMAL(12,8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndiceCAC_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TarifaUOCRA" (
    "id" TEXT NOT NULL,
    "mes" TIMESTAMP(3) NOT NULL,
    "categoria" TEXT NOT NULL,
    "precioDia" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TarifaUOCRA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContratoCliente" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "ocId" TEXT NOT NULL,
    "descripcion" TEXT,
    "presupuestoAprobado" DECIMAL(18,2) NOT NULL,
    "pctAnticipo" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "mesCacBase" TEXT,
    "indiceCACBase" DECIMAL(14,4),
    "pctBlanco" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pctNegro" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pctDesacopio" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "pctIVA" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "presupuestoLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContratoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Certificacion" (
    "id" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "certId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "baseBruta" DECIMAL(18,2) NOT NULL,
    "pctDesacopio" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "desacopio" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "subtotalNeto" DECIMAL(18,2) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'emitido',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Certificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificacionLinea" (
    "id" TEXT NOT NULL,
    "certificacionId" TEXT NOT NULL,
    "codTarea" TEXT NOT NULL,
    "pctAnterior" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "pctActual" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "pctTotal" DECIMAL(8,6) NOT NULL DEFAULT 0,
    "pvTotalTarea" DECIMAL(18,2) NOT NULL,
    "baseCertificada" DECIMAL(18,2) NOT NULL,
    "presupuestoLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificacionLinea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontratoObra" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "contratoId" TEXT NOT NULL,
    "proveedor" TEXT NOT NULL,
    "rubro" TEXT NOT NULL,
    "descripcion" TEXT,
    "montoPpto" DECIMAL(18,2) NOT NULL,
    "ajustaCAC" BOOLEAN NOT NULL DEFAULT false,
    "pctAnticipo" DECIMAL(5,2),
    "pagadoBase" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pagadoCAC" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pagadoCS" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pagadoTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "saldo" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "pctConsumido" DECIMAL(5,2),
    "estado" TEXT NOT NULL DEFAULT 'activo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontratoObra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "cuentaCodigo" TEXT NOT NULL,
    "cuentaNombre" TEXT,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nroAsiento" INTEGER,
    "observaciones" TEXT,
    "proveedor" TEXT,
    "codComprobante" TEXT,
    "nroComprobante" TEXT,
    "debe" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "haber" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "centroCosto" TEXT,
    "subcontratoId" TEXT,
    "movTipo" TEXT,
    "rubroContableId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quincena" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "mes" TIMESTAMP(3) NOT NULL,
    "periodo" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "rubro" TEXT NOT NULL,
    "horasNormales" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "horasExtra50" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "horasExtra100" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "costoTotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "costoDeflactado" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quincena_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GastoDirInd" (
    "id" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GastoDirInd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RubroContable_codigo_key" ON "RubroContable"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "IndiceCAC_mes_key" ON "IndiceCAC"("mes");

-- CreateIndex
CREATE UNIQUE INDEX "TarifaUOCRA_mes_categoria_key" ON "TarifaUOCRA"("mes", "categoria");

-- CreateIndex
CREATE UNIQUE INDEX "ContratoCliente_obraId_ocId_key" ON "ContratoCliente"("obraId", "ocId");

-- CreateIndex
CREATE UNIQUE INDEX "Certificacion_contratoId_certId_key" ON "Certificacion"("contratoId", "certId");

-- CreateIndex
CREATE UNIQUE INDEX "SubcontratoObra_contratoId_key" ON "SubcontratoObra"("contratoId");

-- CreateIndex
CREATE UNIQUE INDEX "Quincena_obraId_mes_periodo_categoria_rubro_key" ON "Quincena"("obraId", "mes", "periodo", "categoria", "rubro");

-- AddForeignKey
ALTER TABLE "ContratoCliente" ADD CONSTRAINT "ContratoCliente_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Certificacion" ADD CONSTRAINT "Certificacion_contratoId_fkey" FOREIGN KEY ("contratoId") REFERENCES "ContratoCliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificacionLinea" ADD CONSTRAINT "CertificacionLinea_certificacionId_fkey" FOREIGN KEY ("certificacionId") REFERENCES "Certificacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontratoObra" ADD CONSTRAINT "SubcontratoObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_subcontratoId_fkey" FOREIGN KEY ("subcontratoId") REFERENCES "SubcontratoObra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_rubroContableId_fkey" FOREIGN KEY ("rubroContableId") REFERENCES "RubroContable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quincena" ADD CONSTRAINT "Quincena_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GastoDirInd" ADD CONSTRAINT "GastoDirInd_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra"("id") ON DELETE CASCADE ON UPDATE CASCADE;
