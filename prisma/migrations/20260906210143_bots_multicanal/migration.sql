-- Conversaciones multicanal: el bot deja de ser solo de WhatsApp.
--
-- Las conversaciones que ya existen son todas de WhatsApp y su chat id ES el
-- teléfono, así que las columnas nuevas se rellenan desde las de teléfono en
-- vez de exigir un valor por omisión. Se agregan permitiendo nulos, se
-- rellenan, y solo entonces se marcan obligatorias: hacerlo al revés falla en
-- cualquier base que ya tenga datos.

CREATE TYPE "CanalMensajeria" AS ENUM ('whatsapp', 'telegram', 'simulador');

-- 1. columnas nuevas, todavía opcionales
ALTER TABLE "ConversacionBot"
  ADD COLUMN "canal" "CanalMensajeria" NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN "chatIdCifrado" TEXT,
  ADD COLUMN "chatIdHash" TEXT;

-- 2. relleno: en WhatsApp el chat id es el teléfono
UPDATE "ConversacionBot"
   SET "chatIdHash" = "telefonoHash",
       "chatIdCifrado" = "telefonoCifrado"
 WHERE "chatIdHash" IS NULL;

-- 3. ahora sí, obligatorias
ALTER TABLE "ConversacionBot"
  ALTER COLUMN "chatIdCifrado" SET NOT NULL,
  ALTER COLUMN "chatIdHash" SET NOT NULL;

-- 4. el teléfono pasa a ser opcional: en Telegram el ciudadano lo comparte
--    después, o nunca
ALTER TABLE "ConversacionBot"
  ALTER COLUMN "telefonoHash" DROP NOT NULL,
  ALTER COLUMN "telefonoCifrado" DROP NOT NULL,
  ALTER COLUMN "telefonoMascara" DROP NOT NULL;

-- 5. a dónde avisarle al ciudadano de cada reporte
ALTER TABLE "Reporte"
  ADD COLUMN "canalNotificacion" "CanalMensajeria",
  ADD COLUMN "destinoNotificacion" TEXT;

-- los reportes que ya existen y traen teléfono se notifican por WhatsApp
UPDATE "Reporte"
   SET "canalNotificacion" = 'whatsapp'
 WHERE "telefonoHash" IS NOT NULL AND "origen" = 'whatsapp';

CREATE INDEX "ConversacionBot_canal_chatIdHash_idx" ON "ConversacionBot"("canal", "chatIdHash");
