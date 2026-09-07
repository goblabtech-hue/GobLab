-- CreateTable
CREATE TABLE "AvisoPrivacidad" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "contenido" TEXT NOT NULL,
    "publicado" BOOLEAN NOT NULL DEFAULT false,
    "notaCambio" TEXT,
    "actualizadoPor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvisoPrivacidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AvisoPrivacidad_version_key" ON "AvisoPrivacidad"("version");

-- CreateIndex
CREATE INDEX "AvisoPrivacidad_publicado_version_idx" ON "AvisoPrivacidad"("publicado", "version");
