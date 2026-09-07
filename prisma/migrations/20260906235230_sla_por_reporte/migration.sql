-- El plazo prometido pasa a guardarse en cada reporte, y la dependencia gana
-- el correo de su responsable.
--
-- Los reportes que ya existen se rellenan con el plazo vigente de su categoría:
-- es la mejor aproximación disponible, y hoy coincide porque ningún plazo se ha
-- cambiado todavía. A partir de aquí, cambiar un plazo ya no toca el histórico.

ALTER TABLE "Dependencia" ADD COLUMN "correo" TEXT;

ALTER TABLE "Reporte" ADD COLUMN "slaDiasHabilesAplicado" INTEGER;

UPDATE "Reporte" r
   SET "slaDiasHabilesAplicado" = c."slaDiasHabiles"
  FROM "Categoria" c
 WHERE c.id = r."categoriaId";

ALTER TABLE "Reporte"
  ALTER COLUMN "slaDiasHabilesAplicado" SET NOT NULL,
  ALTER COLUMN "slaDiasHabilesAplicado" SET DEFAULT 5;
