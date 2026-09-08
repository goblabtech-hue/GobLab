# Lo que falta

Actualizado el 7 de septiembre de 2026.

El SPEC pide **no inventar datos del municipio**. Este documento lleva la cuenta
de qué ya es real, qué sigue siendo de demostración, y qué hace falta para cada
uno de los dos siguientes pasos, que no son el mismo:

- **Enseñárselo a Tula** — que la demostración se vea como su municipio.
- **Atender a un ciudadano de verdad** — que nadie deje su teléfono esperando
  una cuadrilla que no va a salir.

Ningún dato municipal está escrito en el código: todo se lee de la
configuración administrable (`src/infrastructure/config.ts`) o de los catálogos
de `/admin`.

---

## Resumen

| | Qué falta | Quién puede | Bloquea |
|---|---|---|---|
| 🔑 | Llave de la API de Anthropic | Tú, hoy | La demostración |
| 🤖 | Token de @BotFather (Telegram) | Tú, hoy | La demostración |
| 👤 | Nombre de cada titular de área | El municipio | Producción |
| 📅 | Festivos locales (feria, fiestas patronales) | El municipio | Producción |
| ⏱️ | Validar los 12 plazos de atención | Cada dependencia | Producción |
| ⚖️ | Tres datos del aviso de privacidad + revisión jurídica | El jurídico | Producción |
| 🔐 | Borrar cuentas demo y regenerar secretos | Quien despliegue | Producción |
| 🖥️ | Servidor y dominio en vivo | Tú | Ambos |

Lo que ya **no** falta: identidad del municipio, las 8 dependencias reales con
su ruteo, los 143 asentamientos, el bot completo, el informe semanal, el
tablero público y el kit de despliegue.

---

## 1. Lo que ya es real

### Identidad del municipio ✅
Se edita en **`/admin/municipio`**, sin tocar archivos ni reiniciar nada.

| Dato | Valor actual |
|---|---|
| Municipio | Tula de Allende |
| Prefijo del folio | `TUL` (folios como `TUL-2026-00081`) |
| Centro del mapa | 20.0517, −99.3450 |
| Acercamiento | 14 |
| Teléfono de emergencias | 911 |

**Revisar el teléfono de emergencias.** Quedó en 911, que es el nacional y
funciona en Tula. Si el municipio prefiere publicar su línea local de
protección civil, se cambia ahí mismo — debe ser 911, un corto estatal, o un
número a 10 dígitos. No es un detalle: es lo que el bot le dice a alguien
durante un incendio o una fuga de gas.

**Ojo con el prefijo de folio:** cambiarlo después de que existan reportes
arranca una numeración nueva; los folios viejos conservan el prefijo anterior.
La pantalla avisa antes de guardar.

### Dependencias ✅ — 8 reales, del portal del ayuntamiento

Salen de `tula.gob.mx` («Dependencias» y «Directorio»), con sus correos
institucionales y el conmutador (773) 732 0002. Cada uno de los 12 temas está
ruteado al área que de verdad lo atiende:

| Tema | Área |
|---|---|
| Bache, banqueta | Obras Públicas, Desarrollo Urbano y Catastro |
| Luminaria, basura, parque | Servicios Municipales |
| Fuga de agua, drenaje | CAPyAT · Comisión de Agua Potable y Alcantarillado |
| Semáforo | Seguridad Pública y Tránsito Municipal |
| Árbol en riesgo | Protección Ambiental |
| Ruido, comercio irregular | Reglamentos y Espectáculos |
| Animal en la calle | Salud Municipal |
| Solicitud de información | Unidad de Transparencia |

**Falta el nombre de cada titular**, y es a propósito. Vienen con el cargo
(«Titular de Obras Públicas»), no con la persona: mientras la base traiga los
reportes de demostración, el informe semanal mostraría a una funcionaria real
junto a decenas de reportes vencidos que nadie generó. Se capturan en
`/admin/dependencias` el día que los datos sean reales.

También falta el **correo de Reglamentos y Espectáculos**: el directorio
público no lo publica y no se inventó.

### Asentamientos ✅ — 143, del catálogo de Correos de México

No solo colonias: 76 colonias, 27 fraccionamientos, 16 pueblos, 15 rancherías,
4 barrios y algunos ejidos y unidades habitacionales. El municipio es
mayoritariamente eso, y un vecino de San Antonio Tula tiene el mismo derecho a
encontrar su localidad en la lista.

Cada uno lleva su **código postal**, y no es adorno: diez nombres se repiten en
puntos distintos del municipio —«El Cerrito» está en tres— y sin el código una
cuadrilla puede salir al lugar equivocado.

Si el municipio sabe de alguno que falte o sobre, se corrige en
`/admin/colonias`.

---

## 2. Lo que falta para la demostración

### Llave de la API de Anthropic — enciende lo que más impresiona

Sin ella el bot **funciona**: cae al menú de categorías, que es el respaldo que
exige el SPEC §4.1 y está probado. Pero entonces la demostración usa un menú
del 1 al 8, no «cuéntame qué pasa con tus palabras» — que es justo lo que
diferencia esto del sistema al que quiere reemplazar.

Consíguela en [console.anthropic.com](https://console.anthropic.com) y ponla en
`.env`:

```
ANTHROPIC_API_KEY="sk-ant-..."
```

Luego corre el banco de pruebas, que cuesta unos centavos:

```bash
npm run clasificador:ensayo
```

Son 23 casos escritos como escribe la gente —sin acentos, con faltas, en
mayúsculas—: las emergencias que nunca deben quedarse en el chat, las fugas que
la gente describe alarmada pero que no son emergencia, una colonia inexistente
que debe dar `null` en vez de inventarse, un texto con nombre y teléfono que no
deben llegar al resumen, y dos intentos de inyección de instrucciones. Si algo
falla se corrige en el prompt (`src/application/bot/prompts/clasificador.ts`),
no en el código.

### Token de Telegram

Ver la sección 4. Se consigue en dos minutos y no requiere ningún trámite.

### Un servidor

Ver **[DESPLIEGUE.md](DESPLIEGUE.md)**: elección de proveedor con precios, los
pasos exactos del panel de GoDaddy para `demosvoz.com`, HTTPS automático y las
tareas programadas. El kit de despliegue está escrito y probado en lo que se
puede probar sin servidor; falta correrlo contra una máquina real.

### El aviso de demostración se queda encendido

`MODO_DEMO="true"` en `.env` pone en todas las páginas: «Sitio de demostración.
Las cifras son ficticias… Los reportes que se levanten aquí no serán
atendidos». Además bloquea la indexación en buscadores.

**Déjalo encendido mientras la base traiga datos sembrados.** El sitio lleva el
nombre de un municipio real y pide teléfonos: un vecino que llegue por
casualidad y deje su número esperando una cuadrilla es un daño real, no un
detalle de imagen.

---

## 3. Lo que falta para atender a un ciudadano real

### Catálogos que solo el municipio conoce

| Catálogo | Estado | Qué falta |
|---|---|---|
| **Plazos de atención** | Los 12 del SPEC §11 | Validarlos en `/admin/plazos` |
| **Días festivos** | 21 oficiales (LFT art. 74) | Los locales: feria, fiestas patronales |
| **Usuarios** | 8 cuentas de demostración | El personal real, y **borrar las de demo** |

Los plazos de `/admin/plazos` se publican en el tablero abierto y se miden
contra el cumplimiento real. La pantalla pone ese cumplimiento al lado de cada
plazo, para decidir con el dato enfrente. Conviene que los defina quien opera
cada dependencia, no quien instala el sistema.

**Cambiar un plazo no reescribe el pasado:** cada reporte guarda el plazo que
se le prometió el día que se levantó. Bajarlo hoy no convierte en incumplidos a
los reportes ya resueltos.

Los días festivos importan más de lo que parece: definen qué cuenta como día
hábil, y por lo tanto cuándo vence cada compromiso.

### Aviso de privacidad — es un requisito legal, no un trámite

Hay un borrador publicado en `/admin/privacidad` con la estructura que exige la
LGPDPPSO y con lo que el sistema hace de verdad. **Faltan tres datos que el
sistema no puede saber**, marcados como `PENDIENTE` dentro del texto:

1. El domicilio oficial del ayuntamiento.
2. El fundamento legal estatal aplicable.
3. Domicilio, teléfono, correo y horario de la Unidad de Transparencia.

Después, revisión jurídica. Publicar un aviso incompleto y empezar a recolectar
teléfonos de ciudadanos es un incumplimiento, no un pendiente de redacción.

Cada guardado crea una **versión** y solo una está en vigor: la gente aceptó una
redacción concreta el día que reportó, y esa constancia tiene que poder
consultarse. Si el jurídico entrega un Word o un PDF, ábrelo, copia el texto y
pégalo — el editor no lee esos formatos a propósito, porque extraer texto de
ellos da resultados impredecibles en un documento legal.

### Seguridad

- [ ] **Generar secretos nuevos.** Los de desarrollo no deben ser los de
      producción: `openssl rand -base64 32` para `AUTH_SECRET`,
      `PHONE_ENCRYPTION_KEY` y `CRON_SECRET`.
- [ ] **`PHONE_ENCRYPTION_KEY` no se puede perder ni rotar a la ligera.** Con
      ella se cifran los teléfonos de los ciudadanos: si cambia, los ya
      guardados quedan ilegibles y nadie puede ser notificado de su reporte.
      Guárdala donde el ayuntamiento guarda sus contraseñas, no solo en el
      servidor.
- [ ] **Borrar las 8 cuentas de demostración.** Todas usan `Demo1234!`, que
      está publicada en el repositorio. Con el sitio en internet, cualquiera
      entra a la bandeja interna, donde hay teléfonos de ciudadanos.
- [ ] **Apagar `MODO_DEMO`** el día que los datos sean reales.
- [ ] Repositorio en privado si llega a contener algo que no deba ser público:
      `gh repo edit --visibility private`.

---

## 4. Dar de alta los bots

### Telegram — el más rápido, no requiere trámite

Todo el cableado está hecho y probado. Solo falta el token, que únicamente lo
puede pedir una persona desde su Telegram:

1. Busca el contacto **@BotFather** y mándale `/newbot`.
2. Te pide un nombre visible (`Atención Ciudadana Tula`) y un usuario que debe
   terminar en `bot` (`TulaAtencionBot`).
3. Te responde con un token: una línea como `8123456789:AAH…`.
4. Corre esto y pégalo cuando lo pida:

```bash
npm run telegram:conectar
```

Guarda el token en `.env` (que no se sube a git), genera el secreto del
webhook, verifica el token contra Telegram y registra la URL. **El token no se
pasa como argumento**: se teclea a ciegas, para que no quede en el historial del
shell ni en la lista de procesos de la máquina.

Después reinicia el servidor: Next.js lee `.env` al arrancar.

#### Hace falta una URL pública

Telegram no consulta tu servidor: te empuja cada mensaje a una URL, así que
`localhost` no sirve. En producción es el dominio:

```bash
npm run telegram:conectar -- https://demosvoz.com
```

En desarrollo, un túnel en otra terminal (el script lo detecta solo):

```bash
ngrok http 3000
```

Con túnel hay que poner el host que da ngrok en `DEV_ORIGENES_PERMITIDOS`
dentro de `.env`, o Next 16 rechaza las peticiones por venir de otro origen.

#### Comprobar sin Telegram

```bash
npm run telegram:ensayo
```

Levanta una conversación completa contra el webhook real —mismo endpoint, misma
verificación de secreto, mismo motor— alimentándolo con los objetos `Update`
que mandan los servidores de Telegram, y verifica en la base que el reporte
quedó bien. Sirve antes de tener token, y como prueba de regresión después de
tocar el bot.

Lo único que no ejercita es la entrega de vuelta hacia Telegram y la descarga
de fotos, que sí necesitan el token.

Para ver el registro: `npm run telegram:estado`.
Para apagarlo: `bash scripts/telegram-conectar.sh --desconectar`.

Telegram **no firma sus webhooks**: ese secreto es la única defensa contra que
alguien que adivine la URL cree reportes falsos.

### WhatsApp — requiere cuenta de Meta Business

1. Crea una app en developers.facebook.com y agrega el producto WhatsApp.
2. `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` salen de ahí.
3. Inventa `WHATSAPP_VERIFY_TOKEN` y regístralo junto con la URL
   `https://demosvoz.com/api/webhooks/whatsapp`. Meta la verifica con un reto
   que el sistema responde solo.
4. Pon `MESSAGING_DRIVER=whatsapp_cloud`.

Mientras no estén, `/dev/bot` permite recorrer el flujo completo sin
credenciales.

---

## 5. Integraciones que necesitan credenciales

Estado real de este `.env`, hoy:

| Servicio | Variable | Estado | Sin ella qué pasa |
|---|---|---|---|
| Clasificador de IA | `ANTHROPIC_API_KEY` | ❌ vacía | El bot cae al menú de categorías (previsto en el SPEC §4.1) |
| Bot de Telegram | `TELEGRAM_BOT_TOKEN` | ❌ vacía | El bot de Telegram no responde; todo lo demás funciona |
| | `TELEGRAM_WEBHOOK_SECRET` | ✅ generado | — |
| WhatsApp Cloud | `WHATSAPP_*` | ❌ vacías | Se usa el simulador de `/dev/bot` |
| Almacenamiento | `STORAGE_DRIVER` | `local` | Las fotos van a `public/uploads` del servidor. Suficiente en un servidor propio; **no** funciona en Vercel ni en nada sin disco escribible |
| S3 / R2 | `S3_*` | ❌ vacías | — |
| Correo de alertas | `SMTP_*` | ❌ vacías | Las alertas se detectan y se ven en el tablero interno, pero no salen por correo |

> El almacenamiento S3 **ya está implementado** y sirve para AWS S3, Cloudflare
> R2, MinIO o Spaces: solo hay que poner las credenciales y
> `STORAGE_DRIVER=s3`. La CSP y `next/image` toman el dominio de
> `S3_PUBLIC_URL` automáticamente.

---

## 6. Cómo se prueba lo que sí está hecho

```bash
npm test                      # 205 pruebas, 59 suites
npm run lint
npm run build
npm run telegram:ensayo       # el canal de Telegram, sin Telegram
npm run clasificador:ensayo   # el clasificador (necesita llave)
```

El seed además **se niega a terminar** si generó cualquier fecha en el futuro:
un reporte «resuelto» mañana no rompe ninguna pantalla, pero haría que el
informe semanal presuma trabajo que nadie hizo.
