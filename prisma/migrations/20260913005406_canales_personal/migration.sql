-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "codigoVinculacion" TEXT,
ADD COLUMN     "codigoVinculacionExpira" TIMESTAMP(3),
ADD COLUMN     "telefonoCifrado" TEXT,
ADD COLUMN     "telefonoHash" TEXT,
ADD COLUMN     "telegramChatIdCifrado" TEXT,
ADD COLUMN     "telegramChatIdHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_codigoVinculacion_key" ON "Usuario"("codigoVinculacion");

-- CreateIndex
CREATE INDEX "Usuario_telegramChatIdHash_idx" ON "Usuario"("telegramChatIdHash");

-- CreateIndex
CREATE INDEX "Usuario_telefonoHash_idx" ON "Usuario"("telefonoHash");

