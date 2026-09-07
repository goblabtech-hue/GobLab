# Despliegue en un servidor propio

De aquí sale el sitio en vivo, con HTTPS y con el bot de Telegram funcionando.
El orden importa: **el dominio se apunta antes de instalar el certificado**,
porque Let's Encrypt verifica que el nombre realmente resuelva al servidor.

Tiempo aproximado: 40 minutos, de los cuales 30 son esperar al DNS.

---

## 0. Antes de empezar: qué se necesita

| Pieza | Para qué | Costo aproximado |
|---|---|---|
| Un VPS con Ubuntu 24.04 | Correr la plataforma | 4–12 USD/mes |
| El dominio (ya lo tienen) | Que la gente lo encuentre | ya pagado |
| — | HTTPS | gratis (Let's Encrypt vía Caddy) |

### Elegir el VPS

**2 GB de RAM es suficiente.** El build de Next.js es lo único que pide mucha
memoria, y el instalador agrega 4 GB de swap automáticamente si detecta menos
de 3.5 GB. El swap es lento, pero solo se usa al compilar; atender gente no lo
toca. Sin swap, una máquina de 2 GB muere a media compilación con un `Killed`
que no explica nada.

**La ubicación importa más de lo que parece**, por dos razones distintas:

1. *Latencia.* Un servidor en Alemania son ~150 ms de ida y vuelta desde
   Hidalgo; uno en Ciudad de México, ~10 ms. Se nota al cargar el mapa.
2. *El aviso de privacidad.* La plataforma guarda teléfonos de ciudadanos.
   Si el servidor está fuera del país, eso es una transferencia internacional
   de datos personales y el aviso tiene que declararla — es justo el tipo de
   pregunta que sale en la revisión jurídica del ayuntamiento y que puede
   detener la firma. Con el servidor en México, el punto no existe.

| Proveedor | Ubicación útil | Aproximado | Nota |
|---|---|---|---|
| **Vultr** | **Ciudad de México** | ~10 USD/mes por 2 GB | Lo recomendado: es el único de los tres con centro de datos en México |
| Hetzner | Alemania / Virginia | ~4 EUR/mes por 4 GB | El más barato con diferencia, pero fuera del país |
| DigitalOcean | Nueva York / San Francisco | ~12 USD/mes por 2 GB | Documentación excelente en español |

Los precios cambian: confírmalos en la página del proveedor antes de contratar.
Cualquiera de los tres sirve — el instalador es el mismo.

### Antes de crear la máquina: una llave SSH

El formulario del proveedor te va a pedir una llave SSH. Si no le das una, te
manda la contraseña de root por correo — y esa contraseña queda en tu bandeja
de entrada para siempre, mientras robots de todo el mundo prueban contraseñas
contra el puerto 22 de tu servidor desde el primer minuto.

Si nunca has creado una:

```bash
ssh-keygen -t ed25519 -C "demosvoz"
```

Acepta la ruta que propone y **pon una frase de contraseña**: si alguien copia
el archivo de tu Mac, sin la frase no le sirve. Luego copia la llave pública
al portapapeles para pegarla en el formulario:

```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

Se pega el contenido de `.pub` —el archivo terminado en `.pub`, nunca el
otro—. El que no lleva extensión es la llave privada y no sale de tu máquina.

Al crear la máquina: **Ubuntu 24.04 LTS**, la llave SSH pegada, y la ubicación
que hayas elegido arriba.

Cuando termine, el proveedor te da una **IP pública**. Comprueba que entras:

```bash
ssh root@LA-IP
```

> **Una nota sobre el dominio.** `demosvoz.com` es el dominio del producto,
> no el del ayuntamiento, y para una demostración comercial está bien así. Pero
> conviene tenerlo claro desde ahora: **el día que Tula lo compre, la
> plataforma no se queda aquí.** Los ayuntamientos mexicanos tienen derecho a
> un `.gob.mx` a través de NIC México, y un ciudadano al que le piden su
> teléfono confía distinto en `tuladeallende.gob.mx` que en un `.com` ajeno —
> con razón: es exactamente así como se ven los fraudes de trámites.
>
> O sea que habrá dos instalaciones, y está bien: `demosvoz.com` como vitrina
> permanente para enseñarle el producto al siguiente municipio, y una
> instalación por cliente en su propio dominio. Los scripts de despliegue
> sirven igual para las dos.

---

## 1. Apuntar demosvoz.com al servidor

Necesitas la **IP pública del VPS** (te la da tu proveedor al crearlo).

Al momento de escribir esto, el dominio está estacionado en GoDaddy y su DNS
se ve así:

```
demosvoz.com      A       76.223.105.230      ← estacionamiento de GoDaddy
demosvoz.com      A       13.248.243.5        ← estacionamiento de GoDaddy
www.demosvoz.com  CNAME   demosvoz.com        ← ya está bien, no lo toques
demosvoz.com      NS      ns35/ns36.domaincontrol.com
```

Dos cosas que eso te ahorra y una que te puede morder:

- Los nameservers son de GoDaddy, así que **el panel de GoDaddy sí manda**.
  Si apuntaran a otro proveedor, los cambios habría que hacerlos allá.
- El `CNAME` de `www` **ya existe y ya es correcto**. No lo toques.
- **Hay DOS registros `A` en `@`, no uno.** Si editas solo uno, el dominio
  queda repartido entre tu servidor y la página de estacionamiento de GoDaddy:
  el sitio abriría bien más o menos la mitad de las veces, y el error es
  desesperante de diagnosticar porque «a veces sí funciona». Hay que **borrar
  uno y editar el otro.**

### Los pasos

1. GoDaddy → **Mis productos** → `demosvoz.com` → **DNS**.
2. En **Registros**, localiza los dos `A` con nombre `@`.
3. **Borra uno** (el basurero a la derecha).
4. **Edita el que queda:**

   | Tipo | Nombre | Valor | TTL |
   |---|---|---|---|
   | `A` | `@` | la IP de tu VPS | 600 segundos |

   El TTL de 600 es a propósito: si te equivocas, corriges en 10 minutos en
   vez de en un día. GoDaddy trae 1 hora por defecto; cámbialo a
   *Personalizado → 600*.
5. **Apaga el reenvío.** Si en *Reenvío de dominio* hay algo configurado,
   quítalo: GoDaddy lo aplica por encima de los registros y el sitio nunca
   llega al servidor. Es el error más común.

### Comprobar que quedó

Desde tu Mac, no desde el navegador (el navegador cachea y engaña):

```bash
dig +short demosvoz.com
```

Tiene que devolver **una sola** línea: la IP de tu VPS. Si devuelve dos, o
alguna de las de GoDaddy, todavía falta borrar un registro o falta propagar.

**No sigas al paso 3 hasta que esto responda solo con tu IP.** Caddy pedirá el
certificado y si el dominio no resuelve aún, Let's Encrypt lo rechaza y aplica
un límite temporal de reintentos.

## 2. Preparar el servidor

Conéctate por SSH como root y corre:

```bash
git clone https://github.com/goblabtech-hue/GobLab.git /tmp/proyecto
bash /tmp/proyecto/despliegue/instalar-servidor.sh demosvoz.com --privado
```

`--privado` pide un usuario y una contraseña, y deja el sitio entero detrás de
esa puerta. **Para una demostración de ventas es lo correcto**, y no por
pudor: el sitio va a decir «Tula de Allende · Atención Ciudadana», va a pedir
teléfono, y los reportes que levante no los va a atender nadie. Un vecino que
llegue por casualidad y deje su número esperando una cuadrilla es un daño
real, no un detalle de imagen. Con la puerta puesta, solo entra a quien le
pases la clave.

Quítala el día que el sitio sea el del ayuntamiento: borra el bloque
`basic_auth` de `/etc/caddy/Caddyfile` y `sudo systemctl reload caddy`.

Instala Node 22, PostgreSQL 18, Caddy, crea el usuario de servicio `atencion`,
la base de datos, y cierra el firewall dejando abiertos solo SSH, 80 y 443.

La cadena de conexión a la base queda en
`/opt/atencion-ciudadana/.datos-conexion`. La vas a necesitar en el paso
siguiente.

---

## 3. Desplegar la aplicación

```bash
sudo -u atencion -i
git clone https://github.com/goblabtech-hue/GobLab.git /opt/atencion-ciudadana
cd /opt/atencion-ciudadana
cp .env.example .env
```

Edita `.env`. Lo mínimo para arrancar:

```bash
# La que dejó el instalador en .datos-conexion
DATABASE_URL="postgresql://atencion:...@localhost:5432/atencion_ciudadana?schema=public"

# Genera cada uno con: openssl rand -base64 32
AUTH_SECRET="..."
PHONE_ENCRYPTION_KEY="..."
CRON_SECRET="..."

MUNICIPIO_TZ="America/Mexico_City"
STORAGE_DRIVER="local"
```

> **`PHONE_ENCRYPTION_KEY` no se puede cambiar después.** Con ella se cifran
> los teléfonos de los ciudadanos. Si se pierde o se reemplaza, los teléfonos
> ya guardados quedan ilegibles y nadie puede ser notificado de su reporte.
> Guárdala donde guardan las contraseñas del ayuntamiento, no solo en el
> servidor.

Luego:

```bash
bash scripts/desplegar.sh
```

Verifica que no falten secretos, instala dependencias, corre las migraciones,
compila y arranca el servicio. Si algo falla, se detiene y dice dónde.

Abre `https://demosvoz.com`. El candado debe aparecer solo: Caddy pidió el
certificado en la primera visita.

---

## 4. Conectar el bot de Telegram

Ahora que hay un dominio público con HTTPS, el bot ya puede recibir mensajes:

```bash
npm run telegram:conectar -- https://demosvoz.com
```

Pide el token de @BotFather (ver `PENDIENTES.md` §4), registra el webhook y lo
verifica. Después:

```bash
sudo systemctl restart atencion-ciudadana
```

porque Next.js lee `.env` al arrancar.

---

## 5. Tareas programadas

Como usuario `atencion`, `crontab -e`:

```cron
CRON_SECRET=el-mismo-valor-que-en-.env

# Cierra reportes resueltos que nadie calificó (SPEC §4.3)
0 3 * * *    curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://demosvoz.com/api/cron/autocierre
# Alertas internas (§4.5)
0 * * * *    curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://demosvoz.com/api/cron/alertas
# Agregados del tablero y limpieza
*/15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://demosvoz.com/api/cron/indicadores
*/15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://demosvoz.com/api/cron/mantenimiento
```

---

## 6. Antes de que lo vea un ciudadano

Esto **no** es opcional. La base sembrada trae cientos de reportes inventados
a nombre de Tula de Allende, y ocho cuentas de demostración con la contraseña
`Demo1234!`.

- [ ] **`MODO_DEMO`.** Mientras haya datos sembrados, déjalo en `"true"`:
      pone un aviso de «datos ficticios» en todas las páginas. Publicar
      porcentajes de cumplimiento inventados a nombre de un municipio real,
      sin decirlo, es engañoso — un vecino no tiene cómo distinguirlos de las
      cifras verdaderas. Apágalo el día que los datos sean reales.
- [ ] **Borra las ocho cuentas de demostración** y crea las reales en
      `/admin/usuarios`. Con la contraseña publicada en el repositorio,
      cualquiera entra a la bandeja interna, que trae teléfonos de ciudadanos.
- [ ] **Regenera los secretos.** Los que hayan estado en tu Mac durante el
      desarrollo no deben ser los de producción.
- [ ] **Revisión legal del aviso de privacidad** y los tres campos marcados
      `PENDIENTE` en `/admin/privacidad`.
- [ ] Repositorio en privado si contiene algo que no deba ser público:
      `gh repo edit --visibility private`.

---

## Actualizar después

```bash
sudo -u atencion -i
cd /opt/atencion-ciudadana
bash scripts/desplegar.sh
```

## Cuando algo falla

```bash
sudo journalctl -u atencion-ciudadana -n 100 --no-pager   # la aplicación
sudo journalctl -u caddy -n 50 --no-pager                 # HTTPS y proxy
sudo systemctl status atencion-ciudadana
```

**El certificado no se emite.** Casi siempre el DNS todavía no resuelve al
servidor, o quedó encendido el reenvío en GoDaddy. Comprueba con
`dig +short demosvoz.com` desde fuera del servidor.

**502 Bad Gateway.** Caddy está bien pero la aplicación no. Mira el journal
del servicio.

**El bot no contesta.** `npm run telegram:estado` muestra lo que Telegram tiene
registrado, incluido el último error de entrega.
