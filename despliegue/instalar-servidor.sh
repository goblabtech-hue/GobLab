#!/usr/bin/env bash
#
# Prepara un Ubuntu 24.04 recién creado para correr la plataforma.
# Se ejecuta UNA vez, como root, en el servidor:
#
#   bash instalar-servidor.sh atencion.tuladeallende.gob.mx
#
# Deja instalados: Node 22, PostgreSQL 18, Caddy (HTTPS automático), el
# usuario de servicio y el firewall. NO despliega la aplicación: eso lo hace
# desplegar.sh, que ya corre sin privilegios.

set -euo pipefail

DOMINIO="${1:-}"
PRIVADO="${2:-}"
USUARIO=atencion
DESTINO=/opt/atencion-ciudadana
BASE=atencion_ciudadana

[ -n "$DOMINIO" ] || {
  echo "Uso: bash instalar-servidor.sh TU-DOMINIO [--privado]"
  echo
  echo "  --privado  pide usuario y contraseña para entrar al sitio."
  echo "             Recomendado para una demostración: el sitio lleva el"
  echo "             nombre de un municipio real y trae cuentas de prueba."
  exit 1
}
[ "$(id -u)" = "0" ] || { echo "Esto se corre como root."; exit 1; }

paso() { printf '\n\033[1;36m▸ %s\033[0m\n' "$*"; }

paso "Revisando la máquina"
CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
echo "  Sistema: $(. /etc/os-release && echo "$PRETTY_NAME")"
case "$CODENAME" in
  noble|jammy) ;;
  *) echo "  Aviso: este script se escribió para Ubuntu 24.04 (noble)."
     echo "  En $CODENAME puede funcionar, pero no está probado." ;;
esac

RAM_MB=$(free -m | awk '/^Mem:/{print $2}')
echo "  Memoria: ${RAM_MB} MB"

# El build de Next.js es con mucho lo que más memoria pide de todo el ciclo.
# En una máquina de 2 GB se queda sin memoria y el kernel mata el proceso, con
# un error que no dice "te faltó RAM" sino un críptico "Killed". El swap
# convierte un VPS de 10 dólares en uno suficiente; es lento, pero solo se usa
# durante la compilación, no al atender a la gente.
if [ "$RAM_MB" -lt 3500 ] && ! swapon --show | grep -q .; then
  paso "Agregando 4 GB de swap (la memoria no alcanza para compilar)"
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  # Con swap de emergencia conviene que el sistema lo use lo menos posible.
  sysctl -qw vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
  free -h | sed 's/^/  /'
fi

paso "Actualizando el sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq curl ca-certificates gnupg git ufw

paso "Node.js 22 LTS"
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
apt-get install -y -qq nodejs
node --version

paso "PostgreSQL 18"
# Se usa el repositorio oficial de PostgreSQL y no el de Ubuntu, para que el
# servidor corra la misma versión mayor con la que se desarrolló y probó.
install -d /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list
apt-get update -qq
apt-get install -y -qq postgresql-18
systemctl enable --now postgresql

paso "Caddy (servidor web con HTTPS automático)"
# Caddy en lugar de nginx + certbot: pide y renueva el certificado de Let's
# Encrypt solo, sin cron ni renovaciones olvidadas. Un certificado vencido
# tumba el sitio y además rompe el webhook de Telegram.
apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
apt-get update -qq
apt-get install -y -qq caddy

paso "Usuario de servicio ($USUARIO)"
# La aplicación no corre como root: si alguien logra ejecutar código a través
# de ella, queda encerrado en este usuario y no puede tocar el sistema.
id -u "$USUARIO" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$USUARIO"
install -d -o "$USUARIO" -g "$USUARIO" "$DESTINO"

paso "Base de datos"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='$USUARIO'" | grep -q 1 || {
  CLAVE=$(openssl rand -hex 24)
  sudo -u postgres psql -qc "CREATE ROLE $USUARIO LOGIN PASSWORD '$CLAVE';"
  sudo -u postgres psql -qc "CREATE DATABASE $BASE OWNER $USUARIO;"
  echo "postgresql://$USUARIO:$CLAVE@localhost:5432/$BASE?schema=public" \
    > "$DESTINO/.datos-conexion"
  chown "$USUARIO:$USUARIO" "$DESTINO/.datos-conexion"
  chmod 600 "$DESTINO/.datos-conexion"
  echo "  Cadena de conexión guardada en $DESTINO/.datos-conexion"
}

paso "Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 80/tcp   >/dev/null
ufw allow 443/tcp  >/dev/null
# La aplicación escucha solo en 127.0.0.1, así que el 3000 NO se abre: la
# única puerta desde internet es Caddy.
ufw --force enable >/dev/null
ufw status | sed 's/^/  /'

paso "Caddy: sitio $DOMINIO"
# Si el dominio es de segundo nivel (ejemplo.com) también se atiende el www,
# porque la guía de DNS pide crearlo: un nombre que resuelve pero que Caddy no
# tiene declarado da error de certificado en el navegador.
# Contar puntos no sirve: "tuladeallende.gob.mx" tiene dos y aun así es un
# dominio raíz. Se quita primero el sufijo público —y los mexicanos son de dos
# niveles— y se mira si lo que queda es una sola etiqueta.
RESTO="$DOMINIO"
for SUF in gob.mx com.mx org.mx net.mx edu.mx; do
  case "$RESTO" in *".$SUF") RESTO="${RESTO%".$SUF"}"; break ;; esac
done
[ "$RESTO" = "$DOMINIO" ] && RESTO="${DOMINIO%.*}"

case "$RESTO" in
  *.*) NOMBRES="$DOMINIO" ;;              # es un subdominio: no lleva www
  *)   NOMBRES="$DOMINIO, www.$DOMINIO" ;;
esac

# Puerta de entrada opcional. En una demostración no se quiere que un vecino
# llegue por casualidad: el sitio lleva el nombre del municipio, pide teléfono
# y los reportes que levante nadie los va a atender.
PUERTA=""
if [ "$PRIVADO" = "--privado" ]; then
  printf 'Usuario para entrar al sitio [demo]: '
  read -r USR; USR="${USR:-demo}"
  printf 'Contraseña (no se muestra): '
  read -rs CLAVE; echo
  [ -n "$CLAVE" ] || { echo "Contraseña vacía."; exit 1; }
  # Caddy guarda solo el bcrypt: la contraseña en claro no queda en disco.
  HASH=$(caddy hash-password --plaintext "$CLAVE")
  unset CLAVE
  PUERTA=$(printf '\tbasic_auth {\n\t\t%s %s\n\t}\n' "$USR" "$HASH")
fi

cat > /etc/caddy/Caddyfile <<CADDY
$NOMBRES {
$PUERTA
	encode zstd gzip

	# Una sola dirección canónica: si alguien llega por www se le manda al
	# dominio limpio. Dos URLs para el mismo sitio parten las estadísticas y
	# hacen que un folio compartido por WhatsApp se vea distinto según quién
	# lo mandó.
	@www host www.$DOMINIO
	redir @www https://$DOMINIO{uri} permanent

	reverse_proxy 127.0.0.1:3000

	# Las cabeceras de seguridad las pone la aplicación (ver next.config.ts)
	# para que no se dupliquen ni se contradigan con las de aquí.

	log {
		output file /var/log/caddy/$DOMINIO.log
		format json
	}
}
CADDY
systemctl reload caddy || systemctl restart caddy

paso "Servicio systemd"
cp "$(dirname "$0")/atencion-ciudadana.service" /etc/systemd/system/ 2>/dev/null || \
cat > /etc/systemd/system/atencion-ciudadana.service <<UNIT
[Unit]
Description=Plataforma de Atención Ciudadana
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=$USUARIO
WorkingDirectory=$DESTINO
Environment=NODE_ENV=production
Environment=PORT=3000
# -H 127.0.0.1: la aplicación no se asoma a internet por su cuenta; solo Caddy
# la alcanza. Sin esto, el puerto 3000 quedaría accesible saltándose el HTTPS.
ExecStart=/usr/bin/npm run start -- -H 127.0.0.1 -p 3000
Restart=on-failure
RestartSec=5

# Endurecimiento: la aplicación no necesita nada de esto.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DESTINO

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable atencion-ciudadana >/dev/null

cat <<FIN

────────────────────────────────────────────────────────────
Servidor listo. Falta desplegar la aplicación:

  1. Apunta el DNS de $DOMINIO a la IP de este servidor
     (registro A). Caddy no puede pedir el certificado hasta
     que el dominio resuelva aquí.

  2. Como usuario $USUARIO:

       sudo -u $USUARIO -i
       git clone TU-REPOSITORIO $DESTINO
       cd $DESTINO
       cp .env.example .env    # y llénalo (ver DESPLIEGUE.md)
       bash scripts/desplegar.sh

────────────────────────────────────────────────────────────
FIN
