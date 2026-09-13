-- CreateEnum
CREATE TYPE "EstadoModeracion" AS ENUM ('pendiente', 'aprobado', 'oculto');

-- AlterEnum
ALTER TYPE "EstatusReporte" ADD VALUE 'por_validar';

-- AlterTable
ALTER TABLE "ConfiguracionMunicipio" ADD COLUMN     "moderacionPrevia" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Reporte" ADD COLUMN     "moderacion" "EstadoModeracion" NOT NULL DEFAULT 'pendiente',
ADD COLUMN     "moderadoAt" TIMESTAMP(3),
ADD COLUMN     "moderadoPorId" TEXT,
ADD COLUMN     "motivoModeracion" TEXT;

-- CreateIndex
CREATE INDEX "Reporte_moderacion_idx" ON "Reporte"("moderacion");


-- Lo que ya existía era público antes de esta regla; ocultarlo de golpe
-- escondería descripciones que la gente ya vio en su folio.
UPDATE "Reporte" SET "moderacion" = 'aprobado';
