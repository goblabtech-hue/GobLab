-- CreateTable
CREATE TABLE "ConfiguracionMunicipio" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "nombre" TEXT NOT NULL,
    "prefijoFolio" TEXT NOT NULL,
    "centroLat" DOUBLE PRECISION NOT NULL,
    "centroLng" DOUBLE PRECISION NOT NULL,
    "zoomInicial" INTEGER NOT NULL DEFAULT 13,
    "telEmergencias" TEXT NOT NULL,
    "actualizadoAt" TIMESTAMP(3) NOT NULL,
    "actualizadoPor" TEXT,

    CONSTRAINT "ConfiguracionMunicipio_pkey" PRIMARY KEY ("id")
);
