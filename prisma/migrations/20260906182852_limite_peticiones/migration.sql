-- CreateTable
CREATE TABLE "LimitePeticion" (
    "clave" TEXT NOT NULL,
    "ventanaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cuenta" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LimitePeticion_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "LimitePeticion_ventanaAt_idx" ON "LimitePeticion"("ventanaAt");
