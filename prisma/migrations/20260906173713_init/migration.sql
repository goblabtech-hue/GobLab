-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('operador', 'cuadrilla', 'supervisor', 'admin');

-- CreateEnum
CREATE TYPE "OrigenReporte" AS ENUM ('whatsapp', 'web', 'telefono', 'ventanilla');

-- CreateEnum
CREATE TYPE "EstatusReporte" AS ENUM ('nuevo', 'asignado', 'en_atencion', 'resuelto', 'cerrado', 'reabierto', 'duplicado', 'improcedente');

-- CreateEnum
CREATE TYPE "Prioridad" AS ENUM ('normal', 'alta', 'urgente');

-- CreateEnum
CREATE TYPE "TipoFoto" AS ENUM ('ciudadano', 'evidencia');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('creado', 'asignado', 'reasignado', 'comentario', 'en_atencion', 'resuelto', 'cerrado', 'reabierto', 'notificacion', 'calificado', 'adhesion', 'duplicado', 'improcedente', 'publicable');

-- CreateEnum
CREATE TYPE "DireccionMensaje" AS ENUM ('in', 'out');

-- CreateEnum
CREATE TYPE "TipoAlerta" AS ENUM ('vencidos_sobre_umbral', 'caida_calificacion', 'reaperturas_categoria');

-- CreateTable
CREATE TABLE "Dependencia" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "responsable" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dependencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "icono" TEXT NOT NULL,
    "descripcionCorta" TEXT,
    "slaDiasHabiles" INTEGER NOT NULL,
    "requiereEvidencia" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "dependenciaId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Colonia" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "geojson" JSONB,
    "centroLat" DOUBLE PRECISION,
    "centroLng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colonia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaFestivo" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "DiaFestivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioSecuencia" (
    "prefijo" TEXT NOT NULL,
    "anio" INTEGER NOT NULL,
    "ultimo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "FolioSecuencia_pkey" PRIMARY KEY ("prefijo","anio")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashPassword" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "dependenciaId" INTEGER,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reporte" (
    "id" TEXT NOT NULL,
    "folio" TEXT NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "descripcion" TEXT NOT NULL,
    "prioridad" "Prioridad" NOT NULL DEFAULT 'normal',
    "estatus" "EstatusReporte" NOT NULL DEFAULT 'nuevo',
    "origen" "OrigenReporte" NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "direccionTexto" TEXT,
    "coloniaId" INTEGER,
    "telefonoHash" TEXT,
    "telefonoCifrado" TEXT,
    "telefonoMascara" TEXT,
    "nombreContacto" TEXT,
    "dependenciaId" INTEGER NOT NULL,
    "asignadoAId" TEXT,
    "fechaLimite" TIMESTAMP(3) NOT NULL,
    "resueltoAt" TIMESTAMP(3),
    "cerradoAt" TIMESTAMP(3),
    "reabiertoAt" TIMESTAMP(3),
    "calificacion" INTEGER,
    "comentarioCalificacion" TEXT,
    "notaCierre" TEXT,
    "publicable" BOOLEAN NOT NULL DEFAULT false,
    "motivoImprocedente" TEXT,
    "reporteOriginalId" TEXT,
    "vecesReabierto" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotoReporte" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" "TipoFoto" NOT NULL,
    "subidaPorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoReporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoReporte" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "detalle" JSONB,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventoReporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Adhesion" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT NOT NULL,
    "telefonoHash" TEXT NOT NULL,
    "telefonoCifrado" TEXT NOT NULL,
    "telefonoMascara" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Adhesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversacionBot" (
    "id" TEXT NOT NULL,
    "telefonoHash" TEXT NOT NULL,
    "telefonoCifrado" TEXT NOT NULL,
    "telefonoMascara" TEXT NOT NULL,
    "estado" JSONB NOT NULL DEFAULT '{}',
    "escaladaAHumano" BOOLEAN NOT NULL DEFAULT false,
    "atendidaPorId" TEXT,
    "reporteId" TEXT,
    "idioma" TEXT NOT NULL DEFAULT 'es',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversacionBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensajeBot" (
    "id" TEXT NOT NULL,
    "conversacionId" TEXT NOT NULL,
    "direccion" "DireccionMensaje" NOT NULL,
    "texto" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensajeBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClasificacionIA" (
    "id" TEXT NOT NULL,
    "reporteId" TEXT,
    "textoEntrada" TEXT NOT NULL,
    "modelo" TEXT NOT NULL,
    "respuestaJson" JSONB,
    "categoriaId" INTEGER,
    "prioridad" "Prioridad",
    "esEmergencia" BOOLEAN NOT NULL DEFAULT false,
    "usoFallback" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "latenciaMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClasificacionIA_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromesaServicioHistorial" (
    "id" TEXT NOT NULL,
    "categoriaId" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "totalResueltos" INTEGER NOT NULL,
    "aTiempo" INTEGER NOT NULL,
    "cumplimiento" DOUBLE PRECISION NOT NULL,
    "diasPromedio" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromesaServicioHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumenIndicadores" (
    "clave" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "calculadoAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResumenIndicadores_pkey" PRIMARY KEY ("clave")
);

-- CreateTable
CREATE TABLE "AlertaInterna" (
    "id" TEXT NOT NULL,
    "tipo" "TipoAlerta" NOT NULL,
    "mensaje" TEXT NOT NULL,
    "detalle" JSONB,
    "resueltaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertaInterna_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_slug_key" ON "Categoria"("slug");

-- CreateIndex
CREATE INDEX "Categoria_activa_orden_idx" ON "Categoria"("activa", "orden");

-- CreateIndex
CREATE UNIQUE INDEX "Colonia_slug_key" ON "Colonia"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "DiaFestivo_fecha_key" ON "DiaFestivo"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Reporte_folio_key" ON "Reporte"("folio");

-- CreateIndex
CREATE INDEX "Reporte_estatus_idx" ON "Reporte"("estatus");

-- CreateIndex
CREATE INDEX "Reporte_categoriaId_idx" ON "Reporte"("categoriaId");

-- CreateIndex
CREATE INDEX "Reporte_coloniaId_idx" ON "Reporte"("coloniaId");

-- CreateIndex
CREATE INDEX "Reporte_dependenciaId_idx" ON "Reporte"("dependenciaId");

-- CreateIndex
CREATE INDEX "Reporte_createdAt_idx" ON "Reporte"("createdAt");

-- CreateIndex
CREATE INDEX "Reporte_fechaLimite_idx" ON "Reporte"("fechaLimite");

-- CreateIndex
CREATE INDEX "Reporte_telefonoHash_idx" ON "Reporte"("telefonoHash");

-- CreateIndex
CREATE INDEX "Reporte_estatus_fechaLimite_idx" ON "Reporte"("estatus", "fechaLimite");

-- CreateIndex
CREATE INDEX "Reporte_publicable_estatus_idx" ON "Reporte"("publicable", "estatus");

-- CreateIndex
CREATE INDEX "FotoReporte_reporteId_tipo_idx" ON "FotoReporte"("reporteId", "tipo");

-- CreateIndex
CREATE INDEX "EventoReporte_reporteId_timestamp_idx" ON "EventoReporte"("reporteId", "timestamp");

-- CreateIndex
CREATE INDEX "EventoReporte_tipo_timestamp_idx" ON "EventoReporte"("tipo", "timestamp");

-- CreateIndex
CREATE INDEX "Adhesion_reporteId_idx" ON "Adhesion"("reporteId");

-- CreateIndex
CREATE UNIQUE INDEX "Adhesion_reporteId_telefonoHash_key" ON "Adhesion"("reporteId", "telefonoHash");

-- CreateIndex
CREATE INDEX "ConversacionBot_telefonoHash_idx" ON "ConversacionBot"("telefonoHash");

-- CreateIndex
CREATE INDEX "ConversacionBot_escaladaAHumano_idx" ON "ConversacionBot"("escaladaAHumano");

-- CreateIndex
CREATE INDEX "ConversacionBot_createdAt_idx" ON "ConversacionBot"("createdAt");

-- CreateIndex
CREATE INDEX "MensajeBot_conversacionId_timestamp_idx" ON "MensajeBot"("conversacionId", "timestamp");

-- CreateIndex
CREATE INDEX "ClasificacionIA_createdAt_idx" ON "ClasificacionIA"("createdAt");

-- CreateIndex
CREATE INDEX "PromesaServicioHistorial_anio_mes_idx" ON "PromesaServicioHistorial"("anio", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "PromesaServicioHistorial_categoriaId_anio_mes_key" ON "PromesaServicioHistorial"("categoriaId", "anio", "mes");

-- CreateIndex
CREATE INDEX "AlertaInterna_resueltaAt_createdAt_idx" ON "AlertaInterna"("resueltaAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "Dependencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "Dependencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_coloniaId_fkey" FOREIGN KEY ("coloniaId") REFERENCES "Colonia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_dependenciaId_fkey" FOREIGN KEY ("dependenciaId") REFERENCES "Dependencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_asignadoAId_fkey" FOREIGN KEY ("asignadoAId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reporte" ADD CONSTRAINT "Reporte_reporteOriginalId_fkey" FOREIGN KEY ("reporteOriginalId") REFERENCES "Reporte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoReporte" ADD CONSTRAINT "FotoReporte_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoReporte" ADD CONSTRAINT "FotoReporte_subidaPorUserId_fkey" FOREIGN KEY ("subidaPorUserId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReporte" ADD CONSTRAINT "EventoReporte_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventoReporte" ADD CONSTRAINT "EventoReporte_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Adhesion" ADD CONSTRAINT "Adhesion_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversacionBot" ADD CONSTRAINT "ConversacionBot_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensajeBot" ADD CONSTRAINT "MensajeBot_conversacionId_fkey" FOREIGN KEY ("conversacionId") REFERENCES "ConversacionBot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClasificacionIA" ADD CONSTRAINT "ClasificacionIA_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "Reporte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromesaServicioHistorial" ADD CONSTRAINT "PromesaServicioHistorial_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
