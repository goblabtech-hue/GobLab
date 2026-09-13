#!/usr/bin/env bash
#
# Respaldo diario de la plataforma: la base de datos Y las fotos.
#
#     bash scripts/respaldar.sh            # respalda
#     bash scripts/respaldar.sh --listar   # qué respaldos hay
#
# Las dos cosas van juntas a propósito. Un `pg_dump` solo guarda la base, pero
# las fotos —la evidencia del antes y el después, lo que le prueba al vecino
# que sí se arregló— viven en disco, en public/uploads. Un respaldo que
# recupera los reportes sin sus fotos recupera expedientes cojos.
#
# Se conservan 30 días. El instalador lo programa a las 2 de la mañana.

set -euo pipefail
cd "$(dirname "$0")/.."

DESTINO="${RESPALDOS_DIR:-$HOME/respaldos}"
CONSERVAR_DIAS=30
FECHA=$(date +%Y-%m-%d)

if [ "${1:-}" = "--listar" ]; then
  ls -lh "$DESTINO" 2>/dev/null || echo "Todavía no hay respaldos en $DESTINO"
  exit 0
fi

# Prisma agrega `?schema=public` a la URL y pg_dump lo rechaza: se quita.
URL=$(python3 - <<'PY'
import re
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
for l in open('.env', encoding='utf-8'):
    m = re.match(r'\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?', l)
    if m:
        u = urlsplit(m.group(1))
        q = [(k, v) for k, v in parse_qsl(u.query) if k != 'schema']
        print(urlunsplit((u.scheme, u.netloc, u.path, urlencode(q), u.fragment)))
        break
PY
)
[ -n "$URL" ] || { echo "No encontré DATABASE_URL en .env"; exit 1; }

mkdir -p "$DESTINO"
chmod 700 "$DESTINO"   # trae teléfonos cifrados y datos personales: solo el dueño

# Base: formato «custom» de PostgreSQL, comprimido, restaurable con pg_restore
# tabla por tabla si hiciera falta.
pg_dump --format=custom --no-owner --no-privileges "$URL" > "$DESTINO/base-$FECHA.dump"

# Fotos: solo si hay algo que respaldar (con almacenamiento S3 no hay carpeta).
if [ -d public/uploads ] && [ -n "$(ls -A public/uploads 2>/dev/null)" ]; then
  tar -czf "$DESTINO/fotos-$FECHA.tar.gz" -C public uploads
fi

# Limpieza: lo de hace más de 30 días.
find "$DESTINO" -type f \( -name 'base-*.dump' -o -name 'fotos-*.tar.gz' \) -mtime "+$CONSERVAR_DIAS" -delete

echo "Respaldo $FECHA:"
ls -lh "$DESTINO"/*"$FECHA"* | awk '{print "  " $5 "  " $9}'
