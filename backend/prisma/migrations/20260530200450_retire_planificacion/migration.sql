/*
  Warnings:

  - You are about to drop the `Planificacion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PlanificacionFila` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Planificacion" DROP CONSTRAINT "Planificacion_obraId_fkey";

-- DropForeignKey
ALTER TABLE "PlanificacionFila" DROP CONSTRAINT "PlanificacionFila_planificacionId_fkey";

-- DropTable
DROP TABLE "Planificacion";

-- DropTable
DROP TABLE "PlanificacionFila";
