-- Idempotencia de los mensajes del bot.
--
-- Los canales reintentan sus webhooks. Sin una llave estable por mensaje, un
-- reintento vuelve a procesar la misma respuesta del ciudadano y puede crear un
-- reporte duplicado. El id del canal es esa llave.
--
-- Los mensajes que ya existen quedan con idExterno NULL: en Postgres los NULL
-- no chocan entre sí en un índice único, así que la restricción se puede
-- agregar sin tocar el histórico.

ALTER TABLE "MensajeBot" ADD COLUMN "idExterno" TEXT;

CREATE UNIQUE INDEX "MensajeBot_conversacionId_idExterno_key"
  ON "MensajeBot"("conversacionId", "idExterno");
