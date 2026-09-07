# Pendientes del municipio

El SPEC (Notas finales) pide **no inventar datos del municipio**. Todo lo que
aparece abajo son **valores de demostración**: el sistema arranca y se puede
enseñar con ellos, pero hay que sustituirlos antes de salir a producción.

Ningún dato municipal está escrito en el código: todo se lee de variables de
entorno (`src/lib/config.ts`) o del catálogo administrable.

## 1. Identidad del municipio ✅ — ya configurada

Se edita en **`/admin/municipio`**, sin tocar archivos ni reiniciar nada.

| Dato | Valor actual |
|---|---|
| Municipio | Tula de Allende |
| Prefijo del folio | `TUL` (folios `TUL-2026-00341`) |
| Centro del mapa | 20.0517, −99.3450 |
| Acercamiento | 14 |
| Teléfono de emergencias | 911 |

**Revisar el teléfono de emergencias.** Quedó en 911, que es el número nacional
y funciona en Tula. Si el municipio tiene una línea local de protección civil
que prefiera publicar, se cambia en esa misma pantalla — debe ser 911, un corto
estatal, o un número a 10 dígitos.

**Ojo con el prefijo de folio:** cambiarlo después de que existan reportes
arranca una numeración nueva; los folios viejos conservan el prefijo anterior.
La pantalla avisa de esto antes de guardar.

### Lo único que sigue en `.env`
`MUNICIPIO_TZ` (hoy `America/Mexico_City`). No se edita desde la interfaz a
propósito: define qué cuenta como día hábil, y cambiarlo reinterpretaría la
fecha límite de todos los reportes que ya existen.

## 2. Catálogos — se editan en `/admin`, no en el código

| Catálogo | Estado | Qué falta |
|---|---|---|
| **Colonias** | 24 nombres genéricos | Súbelas desde Excel en `/admin/colonias` |
| **Dependencias** | 5 genéricas | Súbelas desde Excel en `/admin/dependencias`, con responsable, teléfono y correo |
| **Plazos de atención** | Los 12 del SPEC §11 | Validarlos en `/admin/plazos`, donde se ve el cumplimiento real al lado |
| **Días festivos** | Solo los oficiales (LFT art. 74) | Agregar los festivos locales (feria, fiestas patronales) |
| **Usuarios** | 8 cuentas de demo | Dar de alta al personal real y **borrar las de demo** |

### Aviso de privacidad
Se administra en `/admin/privacidad`: se pega el texto o se sube un `.txt`/`.md`,
hay vista previa, y **cada guardado crea una versión**. Solo una está en vigor a
la vez, y las anteriores se conservan — la gente aceptó una redacción concreta el
día que reportó, y esa constancia tiene que poder consultarse.

Si el jurídico te entrega un Word o un PDF, ábrelo, copia el texto y pégalo: el
editor no lee esos formatos a propósito, porque extraer texto de ellos produce
resultados impredecibles en un documento legal.

### Cargar colonias y dependencias desde Excel
No hace falta teclearlas una por una. En `/admin/colonias` y
`/admin/dependencias` hay un cargador que acepta `.xlsx` y `.csv`:

| Catálogo | Columnas |
|---|---|
| Colonias | `nombre` (obligatoria), `lat` y `lng` (opcionales) |
| Dependencias | `nombre` y `responsable` (obligatorias), `telefono` y `correo` |

Los encabezados no distinguen mayúsculas, acentos ni espacios: «Nombre de la
Colonia» funciona igual que «nombre». **Se actualiza por nombre, no se
duplica**, así que puedes volver a subir el mismo archivo corregido las veces
que haga falta.

### Las promesas de servicio son un compromiso público
Los plazos de `/admin/plazos` se publican en el tablero abierto y se miden
contra el cumplimiento real. La pantalla pone ese cumplimiento al lado de cada
plazo, para decidir con el dato enfrente. Conviene que los defina quien opera
cada dependencia, no quien instala el sistema.

**Cambiar un plazo no reescribe el pasado:** cada reporte guarda el plazo que se
le prometió el día que se levantó. Bajar un plazo hoy no convierte en
incumplidos a los reportes ya resueltos.

## 3. Seguridad — antes de producción

- [ ] `AUTH_SECRET`, `PHONE_ENCRYPTION_KEY` y `CRON_SECRET` se generaron para
      desarrollo. **Generar nuevos** en producción:
      `openssl rand -base64 32`
- [ ] `PHONE_ENCRYPTION_KEY` **no se puede perder ni rotar a la ligera**: si
      cambia, los teléfonos ya guardados dejan de poder descifrarse.
- [ ] Borrar las 8 cuentas de demo (contraseña `Demo1234!`, igual para todas).
- [ ] **Completar el aviso de privacidad.** Ya hay un borrador publicado en
      `/admin/privacidad` con la estructura que exige la LGPDPPSO y con lo que
      el sistema hace de verdad. Faltan tres cosas que el sistema no puede
      saber, marcadas como `PENDIENTE` dentro del texto: el domicilio del
      ayuntamiento, el fundamento legal estatal y los datos de la Unidad de
      Transparencia. Después, revisión jurídica.

## 4. Dar de alta los bots

### Telegram — es el más rápido, no requiere trámite

Todo el cableado ya está hecho. Solo falta el token, que únicamente lo puede
pedir una persona desde su Telegram:

1. Busca el contacto **@BotFather** y mándale `/newbot`.
2. Te pide un nombre visible (p. ej. `Atención Ciudadana Tula`) y un usuario
   que debe terminar en `bot` (p. ej. `TulaAtencionBot`).
3. Te responde con un token: una línea como `8123456789:AAH…`.
4. Corre esto y pégalo cuando lo pida:

```bash
npm run telegram:conectar
```

El script guarda el token en `.env` (que no se sube a git), genera el secreto
del webhook, verifica el token contra Telegram y registra la URL. **El token no
se pasa como argumento**: se teclea a ciegas, para que no quede en el historial
del shell ni en la lista de procesos de la máquina.

Después hay que reiniciar el servidor: Next.js lee `.env` al arrancar.

#### Hace falta una URL pública

Telegram no consulta tu servidor: te empuja cada mensaje a una URL, así que
`localhost` no sirve. En producción es el dominio del municipio:

```bash
npm run telegram:conectar -- https://tula.gob.mx
```

En desarrollo, un túnel en otra terminal (el script lo detecta solo):

```bash
ngrok http 3000
```

Con túnel hay que agregar el host que da ngrok a `DEV_ORIGENES_PERMITIDOS` en
`.env`, o Next 16 rechaza las peticiones por venir de otro origen.

#### Comprobar sin Telegram

`npm run telegram:ensayo` levanta una conversación completa contra el webhook
real —mismo endpoint, misma verificación de secreto, mismo motor— alimentándolo
con los objetos `Update` que manda Telegram, y verifica que el reporte quede
bien guardado. Sirve para probar el canal antes de tener token, y como prueba
de regresión después de tocar el bot.

Lo único que no ejercita es la entrega de vuelta hacia Telegram, que sí
necesita el token.

Para ver cómo quedó el registro: `npm run telegram:estado`.
Para apagarlo: `bash scripts/telegram-conectar.sh --desconectar`.

Telegram **no firma sus webhooks**: ese secreto es la única defensa contra que
alguien que adivine la URL cree reportes falsos.

### WhatsApp — requiere cuenta de Meta Business
1. Crea una app en developers.facebook.com y agrega el producto WhatsApp.
2. `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` salen de ahí.
3. Inventa `WHATSAPP_VERIFY_TOKEN` y regístralo junto con la URL
   `https://TU-DOMINIO/api/webhooks/whatsapp`. Meta la verifica con un reto que
   el sistema responde solo.
4. Pon `MESSAGING_DRIVER=whatsapp_cloud`.

Mientras no estén, `/dev/bot` permite probar el flujo completo sin credenciales.

## 5. Integraciones que necesitan credenciales

| Servicio | Variable | Sin ella qué pasa |
|---|---|---|
| Clasificador de IA | `ANTHROPIC_API_KEY` | El bot cae al menú de categorías tradicional (previsto en el SPEC §4.1) |
| WhatsApp Cloud API | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` | Se usa el simulador de `/dev/bot` |
| Bot de Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | El bot de Telegram no responde; todo lo demás funciona |
| Almacenamiento S3 | `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT` | Las fotos se guardan en `/public/uploads` del servidor |
| Correo de alertas | `SMTP_*`, `ALERTAS_DESTINATARIOS` | Las alertas se detectan y se ven en el tablero, pero no salen por correo |

> El almacenamiento S3 **ya está implementado** y sirve para AWS S3, Cloudflare
> R2, MinIO o Spaces: solo hay que poner las credenciales y
> `STORAGE_DRIVER=s3`.
