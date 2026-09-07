#!/usr/bin/env bash
#
# Despliega o actualiza la aplicación en el servidor.
# Se corre como el usuario de servicio, dentro del directorio del proyecto:
#
#   bash scripts/desplegar.sh
#
# Es idempotente: se puede correr cuantas veces haga falta.

set -euo pipefail
cd "$(dirname "$0")/.."

SERVICIO=atencion-ciudadana

paso()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }

[ -f .env ] || { rojo "Falta .env. Copia .env.example y llénalo (ver DESPLIEGUE.md)."; exit 1; }

# Un despliegue con secretos vacíos arranca y falla después, en producción, a
# la primera persona que intente entrar o reportar. Mejor detenerse aquí.
faltantes=()
for v in DATABASE_URL AUTH_SECRET PHONE_ENCRYPTION_KEY CRON_SECRET; do
  valor=$(grep -E "^${v}=" .env | head -1 | sed 's/^[^=]*=//; s/^"//; s/"$//')
  [ -n "$valor" ] || faltantes+=("$v")
done
if [ ${#faltantes[@]} -gt 0 ]; then
  rojo "Estas variables están vacías en .env y son obligatorias:"
  printf '   · %s\n' "${faltantes[@]}"
  echo
  echo "Genera los secretos con:  openssl rand -base64 32"
  exit 1
fi

paso "Trayendo la última versión"
git pull --ff-only

paso "Dependencias"
# `npm ci` y no `npm install`: instala exactamente lo del lock, sin actualizar
# nada por su cuenta. Un despliegue no es el momento de estrenar versiones.
npm ci

paso "Migraciones y compilación"
# `npm run build` ya corre `prisma migrate deploy` antes de compilar: el build
# consulta la base para generar las páginas de colonia.
npm run build

paso "Reiniciando el servicio"
if systemctl list-unit-files | grep -q "^${SERVICIO}.service"; then
  sudo systemctl restart "$SERVICIO"
  sleep 3
  systemctl is-active --quiet "$SERVICIO" \
    && echo "  servicio activo" \
    || { rojo "El servicio no arrancó. Revisa: journalctl -u $SERVICIO -n 50"; exit 1; }
else
  echo "  (no hay servicio systemd; arráncalo tú con 'npm start')"
fi

paso "Comprobando que responde"
for i in $(seq 1 15); do
  if curl -fsS -o /dev/null --max-time 3 http://127.0.0.1:3000/; then
    echo "  responde en 127.0.0.1:3000"
    exit 0
  fi
  sleep 2
done
rojo "No respondió tras 30 segundos. Revisa: journalctl -u $SERVICIO -n 50"
exit 1
