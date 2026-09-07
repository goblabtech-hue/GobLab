# Despliegue en un servidor propio

De aquí sale el sitio en vivo, con HTTPS y con el bot de Telegram funcionando.
El orden importa: **el dominio se apunta antes de instalar el certificado**,
porque Let's Encrypt verifica que el nombre realmente resuelva al servidor.

Tiempo aproximado: 40 minutos, de los cuales 30 son esperar al DNS.

---

## 0. Antes de empezar: qué se necesita

| Pieza | Para qué | Costo aproximado |
|---|---|---|
| Un VPS con Ubuntu 24.04 | Correr la plataforma | 5–12 USD/mes |
| El dominio (ya lo tienen) | Que la gente lo encuentre | ya pagado |
| — | HTTPS | gratis (Let's Encrypt vía Caddy) |

Sobre el VPS: 2 GB de RAM es el mínimo cómodo. El build de Next.js es lo que
más memoria consume; con 1 GB hay que agregar swap o compilar en otra máquina.

> **Una nota sobre el dominio.** Si compraron un `.com` o `.mx` comercial,
> funciona perfectamente. Pero para un trámite municipal vale la pena saber
> que los ayuntamientos mexicanos tienen derecho a un `.gob.mx` a través de
> NIC México, y que un ciudadano al que le piden su teléfono confía distinto
> en `tuladeallende.gob.mx` que en un `.com`. No bloquea nada: se puede
> arrancar con el dominio que ya tienen y agregar el `.gob.mx` después —
> Caddy admite varios dominios en el mismo sitio.

---

## 1. Apuntar el dominio de GoDaddy al servidor

Necesitas la **IP pública del VPS** (te la da tu proveedor al crearlo).

1. Entra a GoDaddy → **Mis productos** → busca el dominio → **DNS**.
2. Antes que nada, revisa arriba que diga **«Servidores de nombres de
   GoDaddy»**. Si apuntan a otro proveedor, el panel de GoDaddy no controla
   nada y hay que hacer los cambios allá.
3. En **Registros**, busca el registro `A` con nombre `@`. GoDaddy lo crea
   apuntando a su página de estacionamiento. **Edítalo**, no crees uno nuevo:

   | Tipo | Nombre | Valor | TTL |
   |---|---|---|---|
   | `A` | `@` | la IP de tu VPS | 600 segundos |

4. Agrega el `www`:

   | Tipo | Nombre | Valor | TTL |
   |---|---|---|---|
   | `CNAME` | `www` | `@` | 600 segundos |

5. **Apaga el reenvío.** Si en la sección de *Reenvío de dominio* hay algo
   configurado, quítalo: GoDaddy lo aplica por encima de los registros y el
   sitio nunca llegaría al servidor. Es el error más común.

El TTL de 600 segundos es a propósito: si te equivocas, corriges en 10 minutos
en vez de en un día.

### Comprobar que quedó

Desde tu Mac, no desde el navegador (el navegador cachea y engaña):

```bash
dig +short TU-DOMINIO.com
```

Tiene que devolver la IP de tu VPS. Si devuelve otra cosa o nada, todavía no
propaga; espera y repite. Normalmente son minutos.

**No sigas al paso 3 hasta que esto responda con tu IP.** Caddy pedirá el
certificado y si el dominio no resuelve aún, Let's Encrypt lo rechaza y aplica
un límite temporal de reintentos.

---

## 2. Preparar el servidor

Conéctate por SSH como root y corre:

```bash
git clone TU-REPOSITORIO /tmp/proyecto
bash /tmp/proyecto/despliegue/instalar-servidor.sh TU-DOMINIO.com
```

Instala Node 22, PostgreSQL 18, Caddy, crea el usuario de servicio `atencion`,
la base de datos, y cierra el firewall dejando abiertos solo SSH, 80 y 443.

La cadena de conexión a la base queda en
`/opt/atencion-ciudadana/.datos-conexion`. La vas a necesitar en el paso
siguiente.

---

## 3. Desplegar la aplicación

```bash
sudo -u atencion -i
git clone TU-REPOSITORIO /opt/atencion-ciudadana
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

Abre `https://TU-DOMINIO.com`. El candado debe aparecer solo: Caddy pidió el
certificado en la primera visita.

---

## 4. Conectar el bot de Telegram

Ahora que hay un dominio público con HTTPS, el bot ya puede recibir mensajes:

```bash
npm run telegram:conectar -- https://TU-DOMINIO.com
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
0 3 * * *    curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO.com/api/cron/autocierre
# Alertas internas (§4.5)
0 * * * *    curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO.com/api/cron/alertas
# Agregados del tablero y limpieza
*/15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO.com/api/cron/indicadores
*/15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO.com/api/cron/mantenimiento
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
`dig +short TU-DOMINIO.com` desde fuera del servidor.

**502 Bad Gateway.** Caddy está bien pero la aplicación no. Mira el journal
del servicio.

**El bot no contesta.** `npm run telegram:estado` muestra lo que Telegram tiene
registrado, incluido el último error de entrega.
