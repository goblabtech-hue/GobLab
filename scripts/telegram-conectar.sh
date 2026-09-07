#!/usr/bin/env bash
#
# Conecta el bot de Telegram con esta instalación.
#
# Telegram no consulta tu servidor: te empuja cada mensaje a una URL. Eso
# significa que tu servidor tiene que ser alcanzable desde internet, cosa que
# `localhost` no es. En desarrollo se resuelve con un túnel (ngrok); en
# producción, con el dominio real del municipio.
#
#   ./scripts/telegram-conectar.sh                      # detecta el túnel de ngrok
#   ./scripts/telegram-conectar.sh https://tula.gob.mx  # dominio explícito
#   ./scripts/telegram-conectar.sh --estado             # solo diagnostica
#   ./scripts/telegram-conectar.sh --desconectar        # quita el webhook
#
# El token NUNCA se pasa por la línea de comandos: se teclea a ciegas y se
# guarda en .env, que está en .gitignore. Pasarlo como argumento lo dejaría en
# el historial del shell y en la lista de procesos de la máquina.

set -euo pipefail

cd "$(dirname "$0")/.."
ENV=.env

rojo()  { printf '\033[31m%s\033[0m\n' "$*"; }
verde() { printf '\033[32m%s\033[0m\n' "$*"; }
gris()  { printf '\033[2m%s\033[0m\n' "$*"; }

[ -f "$ENV" ] || { rojo "No encuentro .env. Copia .env.example y vuelve a intentar."; exit 1; }

# Lee una variable de .env sin ejecutar el archivo (un valor con comillas o `$`
# se interpretaría si hiciéramos `source`).
leer() {
  python3 - "$ENV" "$1" <<'PY'
import re, sys
clave = sys.argv[2]
for linea in open(sys.argv[1], encoding='utf-8'):
    m = re.match(rf'\s*{clave}\s*=\s*(.*)\s*$', linea)
    if m:
        v = m.group(1).strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in '"\'':
            v = v[1:-1]
        print(v)
        break
PY
}

escribir() {
  python3 - "$ENV" "$1" "$2" <<'PY'
import re, sys
ruta, clave, valor = sys.argv[1], sys.argv[2], sys.argv[3]
lineas = open(ruta, encoding='utf-8').read().splitlines(keepends=True)
nuevo = f'{clave}="{valor}"\n'
for i, linea in enumerate(lineas):
    if re.match(rf'\s*{clave}\s*=', linea):
        lineas[i] = nuevo
        break
else:
    if lineas and not lineas[-1].endswith('\n'):
        lineas[-1] += '\n'
    lineas.append(nuevo)
open(ruta, 'w', encoding='utf-8').writelines(lineas)
PY
}

api() {  # api <método> [datos...]
  local metodo=$1; shift
  curl -sS --max-time 20 "https://api.telegram.org/bot${TOKEN}/${metodo}" "$@"
}

# Saca un campo anidado de la respuesta JSON: campo result.username
campo() {
  python3 -c '
import json, sys
dato = json.load(sys.stdin)
for llave in sys.argv[1].split("."):
    dato = dato.get(llave) if isinstance(dato, dict) else None
    if dato is None:
        print(""); raise SystemExit
print(dato)
' "$1"
}

TOKEN=$(leer TELEGRAM_BOT_TOKEN)
SECRETO=$(leer TELEGRAM_WEBHOOK_SECRET)

# ── --desconectar ────────────────────────────────────────────────────────────
if [ "${1:-}" = "--desconectar" ]; then
  [ -n "$TOKEN" ] || { rojo "No hay token en .env; no hay nada que desconectar."; exit 1; }
  api deleteWebhook -d drop_pending_updates=false >/dev/null
  verde "Webhook eliminado. El bot deja de recibir mensajes."
  exit 0
fi

# ── Token ────────────────────────────────────────────────────────────────────
if [ -z "$TOKEN" ]; then
  if [ "${1:-}" = "--estado" ]; then rojo "Falta TELEGRAM_BOT_TOKEN en .env."; exit 1; fi
  echo
  echo "No hay token de bot todavía. Para obtenerlo:"
  echo
  echo "   1. Abre Telegram y busca el contacto  @BotFather"
  echo "   2. Envíale   /newbot"
  echo "   3. Te pide un nombre visible, p. ej.  Atención Ciudadana Tula"
  echo "   4. Te pide un usuario, que debe terminar en 'bot', p. ej.  TulaAtencionBot"
  echo "   5. Te responde con una línea como  8123456789:AAH...  ← ese es el token"
  echo
  gris "   Se teclea a ciegas (no se muestra) y se guarda en .env, que no se sube a git."
  printf 'Pega el token y pulsa Enter: '
  read -rs TOKEN
  echo
  TOKEN=$(printf '%s' "$TOKEN" | tr -d '[:space:]')
  [ -n "$TOKEN" ] || { rojo "No tecleaste nada."; exit 1; }
  case "$TOKEN" in
    *:*) ;;
    *) rojo "Eso no parece un token de Telegram (deben ser dígitos, dos puntos y una cadena larga)."; exit 1 ;;
  esac
  escribir TELEGRAM_BOT_TOKEN "$TOKEN"
  verde "Token guardado en .env"
fi

# ── Secreto del webhook ──────────────────────────────────────────────────────
# Telegram no firma sus peticiones. Este secreto viaja en una cabecera y es lo
# único que impide que cualquiera que adivine la URL invente reportes.
if [ -z "$SECRETO" ]; then
  SECRETO=$(openssl rand -hex 32)
  escribir TELEGRAM_WEBHOOK_SECRET "$SECRETO"
  verde "Secreto de webhook generado y guardado en .env"
fi

# ── ¿El token sirve? ─────────────────────────────────────────────────────────
YO=$(api getMe)
if [ "$(printf '%s' "$YO" | campo ok)" != "True" ]; then
  rojo "Telegram rechazó el token:"
  printf '%s\n' "$YO" | python3 -m json.tool
  echo
  gris "Si el token es viejo o se filtró, pide uno nuevo a @BotFather con /revoke,"
  gris "borra la línea TELEGRAM_BOT_TOKEN de .env y vuelve a correr este script."
  exit 1
fi
USUARIO=$(printf '%s' "$YO" | campo result.username)
verde "Bot verificado: @${USUARIO}"

if [ "${1:-}" = "--estado" ]; then
  echo
  echo "Estado del webhook según Telegram:"
  api getWebhookInfo | python3 -m json.tool
  exit 0
fi

# ── URL pública ──────────────────────────────────────────────────────────────
BASE="${1:-}"
if [ -z "$BASE" ]; then
  BASE=$(curl -sS --max-time 5 http://127.0.0.1:4040/api/tunnels 2>/dev/null \
    | python3 -c 'import json,sys
try: t=json.load(sys.stdin)["tunnels"]
except Exception: sys.exit()
for x in t:
    if x.get("proto")=="https": print(x["public_url"]); break' || true)
  [ -n "$BASE" ] && gris "Túnel de ngrok detectado: $BASE"
fi

if [ -z "$BASE" ]; then
  rojo "No sé en qué URL pública vive este servidor."
  echo
  echo "  En desarrollo, levanta un túnel en otra terminal:"
  echo "      ngrok http 3000"
  echo "  y vuelve a correr este script."
  echo
  echo "  En producción, pásale el dominio:"
  echo "      ./scripts/telegram-conectar.sh https://tula.gob.mx"
  exit 1
fi

case "$BASE" in
  https://*) ;;
  *) rojo "Telegram solo entrega webhooks por HTTPS. Recibí: $BASE"; exit 1 ;;
esac

URL="${BASE%/}/api/webhooks/telegram"

RES=$(api setWebhook \
  -d "url=${URL}" \
  -d "secret_token=${SECRETO}" \
  -d "allowed_updates=[\"message\",\"callback_query\"]" \
  -d "drop_pending_updates=true")

if [ "$(printf '%s' "$RES" | campo ok)" != "True" ]; then
  rojo "Telegram rechazó el webhook:"
  printf '%s\n' "$RES" | python3 -m json.tool
  exit 1
fi

echo
verde "Listo. Telegram entregará los mensajes en:"
echo "   $URL"
echo
echo "Escríbele a  https://t.me/${USUARIO}  y manda  hola"
echo
gris "Si acabas de guardar el token, reinicia el servidor (npm run dev):"
gris "Next.js lee .env al arrancar y no lo relee solo."
