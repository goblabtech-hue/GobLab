#!/usr/bin/env bash
#
# Deja el bot de Telegram contestando, en un solo comando:
#
#     npm run telegram
#
# Arranca la base si hace falta, el servidor, el túnel público, pide el token
# la primera vez y registra el webhook. Se puede correr las veces que quieras:
# si algo ya está andando, lo reutiliza; si algo se cayó, lo levanta.
#
# Existe porque hacerlo a mano son cinco pasos en dos terminales, y el túnel y
# el servidor se mueren al cerrar la sesión: al día siguiente nada funciona y
# no es evidente por qué.

set -euo pipefail
cd "$(dirname "$0")/.."
ENV=.env

paso()  { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }
ok()    { printf '  \033[32m✓\033[0m %s\n' "$*"; }
malo()  { printf '  \033[31m✗\033[0m %s\n' "$*"; }
gris()  { printf '\033[2m%s\033[0m\n' "$*"; }

[ -f "$ENV" ] || { malo "No hay .env. Copia .env.example y llénalo."; exit 1; }

leer() {
  python3 - "$ENV" "$1" <<'PY'
import re, sys
for linea in open(sys.argv[1], encoding='utf-8'):
    m = re.match(rf'\s*{sys.argv[2]}\s*=\s*(.*)\s*$', linea)
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
ruta, clave, valor = sys.argv[1:4]
lineas = open(ruta, encoding='utf-8').read().splitlines(keepends=True)
nueva = f'{clave}="{valor}"\n'
for i, l in enumerate(lineas):
    if re.match(rf'\s*{clave}\s*=', l):
        lineas[i] = nueva
        break
else:
    if lineas and not lineas[-1].endswith('\n'): lineas[-1] += '\n'
    lineas.append(nueva)
open(ruta, 'w', encoding='utf-8').writelines(lineas)
PY
}

api() { local m=$1; shift; curl -sS --max-time 20 "https://api.telegram.org/bot${TOKEN}/${m}" "$@"; }

campo() {
  python3 -c '
import json, sys
d = json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d = d.get(k) if isinstance(d, dict) else None
    if d is None: print(""); raise SystemExit
print(d)
' "$1"
}


# ── 1. El token, antes que nada: así el servidor arranca una sola vez ────────
paso "Token del bot"
TOKEN=$(leer TELEGRAM_BOT_TOKEN)

if [ -z "$TOKEN" ]; then
  cat <<'AYUDA'
  Todavía no hay token. Para conseguirlo, en Telegram:

     1. Busca el contacto   @BotFather
     2. Mándale             /newbot
     3. Nombre visible:     Atención Ciudadana Tula
     4. Usuario (debe terminar en «bot»):   TulaAtencionBot
     5. Te contesta con una línea como:     8123456789:AAHdq...

AYUDA
  # El token SÍ se ve al pegarlo, a propósito. La primera versión lo ocultaba
  # con `read -s` y el resultado fue que nadie sabía si su pegado había
  # entrado: se pulsaba Enter sobre una pantalla vacía y el script moría
  # diciendo «no tecleaste nada». Ocultarlo tampoco compraba lo importante —
  # lo que `read` consume nunca entra al historial del shell ni aparece en
  # `ps`, se vea o no en pantalla.
  gris "  Al pegarlo SÍ se va a ver. No queda en el historial de la terminal."
  for intento in 1 2 3; do
    printf '  Pega el token y pulsa Enter: '
    read -r TOKEN || true
    TOKEN=$(printf '%s' "${TOKEN:-}" | tr -d '[:space:]')
    [ -z "$TOKEN" ] && { malo "No entró nada. Intenta con ⌘V y luego Enter."; continue; }
    case "$TOKEN" in
      *:*) break ;;
      *) malo "Eso no parece un token: van dígitos, dos puntos y una cadena larga." ;;
    esac
    TOKEN=""
  done
  if [ -z "${TOKEN:-}" ]; then
    echo
    malo "No se pudo leer el token."
    gris "  Alternativa: ábre el archivo .env y pon el token entre las comillas de"
    gris "  la línea TELEGRAM_BOT_TOKEN=\"\". Luego vuelve a correr: npm run telegram"
    exit 1
  fi
  escribir TELEGRAM_BOT_TOKEN "$TOKEN"
  ok "Guardado en .env (que no se sube a git)"
else
  ok "Ya había uno en .env"
fi

RES=$(api getMe)
if [ "$(printf '%s' "$RES" | campo ok)" != "True" ]; then
  malo "Telegram rechazó el token:"
  printf '%s\n' "$RES" | python3 -m json.tool | sed 's/^/    /'
  echo
  gris "  Si el token es viejo o se filtró, pide otro a @BotFather con /revoke,"
  gris "  borra la línea TELEGRAM_BOT_TOKEN de .env y vuelve a correr esto."
  exit 1
fi
USUARIO=$(printf '%s' "$RES" | campo result.username)
ok "Verificado con Telegram: @${USUARIO}"

# Telegram no firma sus webhooks: este secreto es la única defensa contra que
# alguien que adivine la URL invente reportes.
SECRETO=$(leer TELEGRAM_WEBHOOK_SECRET)
if [ -z "$SECRETO" ]; then
  SECRETO=$(openssl rand -hex 32)
  escribir TELEGRAM_WEBHOOK_SECRET "$SECRETO"
  ok "Secreto del webhook generado"
fi


# ── 2. Base de datos ────────────────────────────────────────────────────────
paso "Base de datos"
if pg_isready -q 2>/dev/null; then
  ok "PostgreSQL responde"
else
  gris "  No responde; intentando arrancarlo con brew…"
  brew services start postgresql@18 >/dev/null 2>&1 || brew services start postgresql >/dev/null 2>&1 || true
  for _ in $(seq 1 15); do pg_isready -q 2>/dev/null && break; sleep 1; done
  pg_isready -q 2>/dev/null && ok "Arrancó" || { malo "No pude arrancar PostgreSQL. Levántalo y vuelve a intentar."; exit 1; }
fi


# ── 3. Túnel público ────────────────────────────────────────────────────────
# Telegram no consulta tu servidor: le empuja cada mensaje a una URL, y
# localhost no es alcanzable desde internet.
paso "Túnel público"
urlTunel() {
  curl -sS --max-time 3 http://127.0.0.1:4040/api/tunnels 2>/dev/null | python3 -c '
import json, sys
try: t = json.load(sys.stdin)["tunnels"]
except Exception: sys.exit()
for x in t:
    if x.get("proto") == "https": print(x["public_url"]); break' 2>/dev/null || true
}

PUBLICA=$(urlTunel)
if [ -n "$PUBLICA" ]; then
  ok "Ya había uno: $PUBLICA"
else
  command -v ngrok >/dev/null || { malo "Falta ngrok. Instálalo con: brew install ngrok"; exit 1; }
  nohup ngrok http 3000 --log=stdout > /tmp/ngrok.log 2>&1 &
  for _ in $(seq 1 25); do PUBLICA=$(urlTunel); [ -n "$PUBLICA" ] && break; sleep 1; done
  [ -n "$PUBLICA" ] || { malo "ngrok no arrancó:"; tail -15 /tmp/ngrok.log | sed 's/^/    /'; exit 1; }
  ok "Levantado: $PUBLICA"
fi

# Next 16 rechaza las peticiones que llegan con un Host que no es localhost
# salvo que el origen esté declarado.
HOST="${PUBLICA#https://}"
if [ "$(leer DEV_ORIGENES_PERMITIDOS)" != "$HOST" ]; then
  escribir DEV_ORIGENES_PERMITIDOS "$HOST"
  ok "Origen declarado para Next"
  REINICIAR=1
fi


# ── 4. Servidor ─────────────────────────────────────────────────────────────
# Next lee .env al arrancar: si acabamos de tocarlo, hay que reiniciarlo o el
# bot no tendría token para contestar.
paso "Servidor"
if pgrep -f "next dev" >/dev/null && [ -z "${REINICIAR:-}" ] \
   && curl -s -o /dev/null --max-time 3 http://localhost:3000/; then
  ok "Ya estaba corriendo"
else
  pgrep -f "next dev" >/dev/null && { pkill -f "next dev"; sleep 2; }
  nohup npm run dev > /tmp/next-dev.log 2>&1 &
  printf '  arrancando'
  for _ in $(seq 1 60); do
    if curl -s -o /dev/null --max-time 2 http://localhost:3000/; then echo; ok "Listo en localhost:3000"; break; fi
    printf '.'; sleep 1
  done
  curl -s -o /dev/null --max-time 3 http://localhost:3000/ || {
    echo; malo "No arrancó. Últimas líneas:"; tail -20 /tmp/next-dev.log | sed 's/^/    /'; exit 1; }
fi


# ── 5. Registrar el webhook ─────────────────────────────────────────────────
paso "Conectando Telegram con el servidor"
URL="${PUBLICA%/}/api/webhooks/telegram"
RES=$(api setWebhook \
  -d "url=${URL}" \
  -d "secret_token=${SECRETO}" \
  -d 'allowed_updates=["message","callback_query"]' \
  -d 'drop_pending_updates=true')

if [ "$(printf '%s' "$RES" | campo ok)" != "True" ]; then
  malo "Telegram rechazó el webhook:"
  printf '%s\n' "$RES" | python3 -m json.tool | sed 's/^/    /'
  exit 1
fi
ok "Registrado en $URL"

# Que el propio servidor confirme que la puerta está bien cerrada.
sin=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$URL" -H 'Content-Type: application/json' -d '{}')
con=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -X POST "$URL" -H 'Content-Type: application/json' \
      -H "x-telegram-bot-api-secret-token: $SECRETO" -d '{}')
[ "$sin" = "401" ] && ok "Rechaza a quien no trae el secreto" || malo "Ojo: sin secreto respondió $sin, debería ser 401"
[ "$con" = "200" ] && ok "Acepta a Telegram" || malo "Ojo: con secreto respondió $con, debería ser 200"


cat <<FIN

  ────────────────────────────────────────────────
   Listo. Escríbele a tu bot:

       https://t.me/${USUARIO}

   Mándale «hola» y sigue la conversación.
  ────────────────────────────────────────────────

FIN
gris "  El túnel y el servidor viven mientras esta computadora esté encendida y"
gris "  no se cierre la sesión. Si mañana no contesta, vuelve a correr:"
gris "      npm run telegram"
gris "  (la URL del túnel cambia cada vez, y el webhook se re-registra solo)"
