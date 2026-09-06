# Progreso

Bitácora por fases del plan del SPEC §12.

---

## Fase 1 — Fundación ✅

**Entregable pedido:** login por rol y administración de catálogos.

### Hecho

**Base del proyecto**
- Next.js 16.3 (App Router) + TypeScript + Tailwind v4, `src/`, alias `@/*`.
- PostgreSQL 18 + Prisma 7.10.0 (fijado a estable, ver DECISIONES D-03).
- Build de producción y `tsc --noEmit` en verde.

**Modelo de datos** — `prisma/schema.prisma`, 18 entidades
- Las del SPEC §5, más cuatro que el spec necesitaba y no declaraba:
  `DiaFestivo` (C-03), `FolioSecuencia` (C-04), `ResumenIndicadores` (C-06) y
  `ClasificacionIA` (auditoría del clasificador, SPEC §4.1).
- Migración inicial aplicada.

**Módulos base** — `src/lib/`
- `sla.ts` — días hábiles y fecha límite sobre fechas civiles en la zona
  horaria del municipio (C-09); semáforo verde/ámbar/rojo; caché de festivos.
- `folio.ts` — folio `PREFIJO-AAAA-NNNNN` con reserva atómica (C-04).
- `telefono.ts` — hash HMAC + cifrado AES-256-GCM + máscara `81••••1212` (C-05).
- `duplicados.ts` — Haversine con prefiltro por caja delimitadora.
- `config.ts` — todo dato municipal viene de variables de entorno.
- `presentacion.ts` — el diccionario de lenguaje ciudadano de cada estatus.

**Autenticación y permisos**
- Auth.js v5 con credenciales, sesión JWT en cookie httpOnly, expira a 8 h.
- `proxy.ts` (Next 16) decide "hay sesión o no"; el permiso por rol se aplica
  en el servidor, en el layout de cada sección.
- Mensaje de error único al fallar el login, para no permitir enumerar cuentas.

**Administración de catálogos** — `/admin`
- Categorías y promesas de servicio, dependencias, colonias, días festivos y
  usuarios. Alta y edición, validación con Zod del lado servidor.
- Agregar o quitar un día festivo invalida el caché del cálculo de días hábiles.

**Datos semilla** — `prisma/seed.ts`, reproducible (PRNG con semilla fija)
- 12 categorías, 5 dependencias, 24 colonias, 21 festivos, 8 usuarios (2 por rol).
- 400 reportes en 13 meses, con los casos que los criterios de aceptación
  necesitan poder demostrar:

  | Caso | Cantidad |
  |---|---|
  | Abiertos vencidos | 88 |
  | Resueltos fuera de plazo | 61 |
  | En `resuelto`, esperando calificación | 30 |
  | Reabiertos | 16 |
  | Con calificación ciudadana | 168 |
  | Publicables (antes/después) | 30 |
  | Con evento de reasignación | 5% |
  | Abiertos a <100 m entre sí (duplicados) | 12 |
  | Conversaciones de bot | 291 |

- Imágenes placeholder generadas localmente con sharp, sin descargar nada.

### Validación

**Pruebas automatizadas** — `npm test`, 14 suites, 0 fallos
- `sla.ts` — fines de semana, festivos, hora local vs. UTC, fin del día,
  días hábiles entre fechas, semáforo.
- `folio.ts` — formato, año en zona local, y **50 reservas simultáneas que
  producen 50 folios distintos y contiguos** (la prueba de la corrección C-04).
- `telefono.ts` — normalización de las seis formas de escribir un número,
  hash determinista, ciclo de cifrado, texto alterado que no se descifra en
  silencio, máscara.
- `duplicados.ts` — Haversine contra distancias conocidas y la esquina de la
  caja delimitadora (~141 m) que no debe contar como duplicado.

**Bug encontrado y corregido por las pruebas:** la conversión de hora local
perdía los milisegundos y toda fecha límite caía en el día siguiente
(corrección C-11 en DECISIONES.md). El seed se regeneró: las 400 fechas límite
quedan a las 23:59:59 hora local, ninguna en fin de semana ni en festivo.

**Matriz de permisos** — probada por HTTP con los cuatro roles

| | /bandeja | /cuadrilla | /ejecutivo | /admin |
|---|---|---|---|---|
| anónimo | login | login | login | login |
| operador | acceso | bloqueado | bloqueado | bloqueado |
| cuadrilla | bloqueado | acceso | bloqueado | bloqueado |
| supervisor | acceso | acceso | acceso | bloqueado |
| admin | acceso | acceso | acceso | acceso |

Contraseña incorrecta y cuenta inexistente: no crean sesión.
Desactivar una cuenta expulsa **en la carga siguiente**, no al expirar el token;
cambiar el perfil surte efecto de inmediato (decisión D-08).

**Catálogos, probados en el navegador**
- Categorías: editar la promesa de "Bache" (5 → 7 días) persiste.
- Colonias: alta de "Ampliación San Andrés" → slug `ampliacion-san-andres`
  (acentos correctos) y coordenadas guardadas.
- Usuarios: correo duplicado rechazado; alta con correo con espacios y
  mayúsculas → se normaliza, se cifra con bcrypt, **y la cuenta nueva entra**
  con los permisos de su perfil.
- Festivos: alta y baja funcionan, y el alta **recorre las fechas límite un día**
  (13 → 14 de octubre), que es el efecto que debía tener.

**Levantar desde cero** (criterio de aceptación 7) — en una base vacía:
`migrate deploy` + `seed` corren limpio; 400 folios únicos, ninguna fecha límite
nula, ningún resuelto sin evidencia en categoría que la exige, ninguna
calificación fuera de 1–5, ningún teléfono en claro.

`npm run build`, `npx tsc --noEmit` y `npx eslint .` en verde.

### Pendiente de la fase
- Los datos del municipio siguen siendo de demostración → `PENDIENTES.md`.

---

## Fase 2 — Ciclo del reporte (web) ✅

**Entregable pedido:** ciclo de vida completo sin bot.

### Hecho

**Servicio del ciclo de vida** — `src/lib/reportes.ts`
- Tabla explícita de transiciones válidas: lo que no está declarado, no se
  permite. Ninguna pantalla toca `estatus` directo, todo pasa por aquí y deja
  evento en la bitácora — de ahí salen los KPIs de reasignación y reapertura.
- Alta con folio, fecha límite y dependencia; adhesiones que suben prioridad;
  duplicados; reasignación con motivo obligatorio; improcedente con motivo
  público; resolución con evidencia obligatoria; calificación; reapertura una
  sola vez; autocierre a los 3 días.

**Sitio ciudadano** — mobile-first, sin cuenta
- Portada con el resumen de 12 meses en vivo.
- `/reportar`: categorías con ícono, fotos con vista previa, ubicación por GPS
  o pin arrastrable (Leaflet + OpenStreetMap) con la colonia como respaldo, y
  **detección de duplicados en vivo**: al poner el pin, si ya hay reportes
  abiertos de lo mismo a menos de 100 m, se ofrece sumarse en vez de duplicar.
- `/folio` y `/folio/[folio]`: seguimiento con línea de tiempo en lenguaje
  ciudadano, evidencia de cómo quedó, calificación por estrellas y reapertura.

**Pantallas internas**
- `/bandeja`: filtros por estatus, categoría, colonia, dependencia, prioridad y
  canal, más búsqueda por folio o texto. Los filtros van por GET, así que una
  búsqueda se puede compartir o guardar. Tabla en escritorio, tarjetas en
  celular. Un supervisor solo ve lo de su dependencia.
- `/bandeja/[folio]`: detalle con bitácora completa y panel de acciones.
- `/cuadrilla`: "Mis reportes" ordenados por vencimiento, pensada para usarse
  de pie en la calle; cierre que **exige foto** y no habilita el botón sin ella.

**Infraestructura**
- `StorageProvider` intercambiable (local en desarrollo, S3 pendiente de
  credenciales) con re-codificación obligatoria de cada imagen.
- Limitador de peticiones respaldado en Postgres, no en memoria del proceso.
- Endpoints `/api/cron/autocierre` y `/api/cron/mantenimiento` protegidos con
  secreto y comparación de tiempo constante (corrección C-07).

### Validación

**Pruebas** — `npm test`, 25 suites, 0 fallos (11 nuevas en esta fase)
- Ciclo de vida contra la base real: transiciones válidas e inválidas, evidencia
  obligatoria, no resolver dos veces, calificación fuera de rango, reapertura
  solo con calificación baja y solo una vez, motivo obligatorio al reasignar,
  adhesión que no se duplica, autocierre que respeta los recientes.
- Saneamiento de imágenes: **se borra el EXIF, incluida la ubicación GPS** —
  importante porque estas fotos se publican en la galería antes/después—,
  se reduce a 1600 px, todo sale como JPEG, se rechaza un ejecutable renombrado
  a `.jpg`, y dos fotos con el mismo nombre no se pisan.
- Limitador: 20 peticiones simultáneas cuentan las 20, sin perder ninguna.

**Extremo a extremo, en el navegador**
- Reporte real creado desde el sitio público (`MUN-2026-00266`): folio, promesa
  de 5 días hábiles con vencimiento correcto al 11 de septiembre, y **el
  teléfono no aparece en el HTML público** (verificado contra el número, el
  nombre y los campos del modelo).
- Bandeja: asignación de cuadrilla, y el teléfono completo revelado bajo demanda
  queda registrado en la bitácora con nombre y hora.
- Cuadrilla en pantalla de celular: el botón de resolver está deshabilitado sin
  foto, con el aviso correspondiente.
- Ciclo cerrado: en atención → resuelto con evidencia → calificado con 2
  estrellas → reabierto, y la página del ciudadano muestra los ocho pasos de la
  línea de tiempo en lenguaje claro.
- Cron: 401 sin secreto y con secreto incorrecto; 200 con el correcto.

### Pendiente de la fase
- Las notificaciones al ciudadano se registran como evento pero todavía no
  salen: el envío llega con el `MessagingProvider` de la Fase 3.
- `S3Storage` es una interfaz sin implementar hasta que el municipio elija
  proveedor (`PENDIENTES.md` §4).

---

## Fase 4 — Tablero público ✅

Se adelantó a la Fase 3 a petición del equipo: es la pantalla que se presenta a
las autoridades y no depende de nada del bot.

**Entregable pedido:** agregados precalculados, las siete secciones del SPEC
§4.4 (a–g), datos abiertos y mapa.

### Hecho

**Motor de indicadores** — `src/lib/indicadores.ts`
- Las ocho fórmulas del SPEC §6, todas con comparación contra el periodo
  anterior. Se calcula todo de una pasada (~95 ms) y se guarda en la tabla de
  resumen; si tiene más de 15 minutos se recalcula solo. Si el cálculo falla
  pero hay un resumen viejo, se sirve ese: más vale un tablero de hace media
  hora que una página rota.
- El promedio de días hábiles se calcula en JavaScript, no en SQL, para no
  tener dos definiciones de "día hábil" que se puedan desincronizar.

**Las siete secciones del tablero** — `/tablero`
- **a)** Resumen de 12 meses, más las tres cifras incómodas que el spec pide
  conservar de San Pedro: vencidos, reasignados y reabiertos.
- **b)** Promesas de servicio: plazo prometido contra cumplimiento real y
  tiempo promedio, por categoría, con semáforo verde/ámbar/rojo. Es el
  diferenciador que San Pedro no tiene.
- **c)** Mapa integrado en la página —no en un iframe aparte—, con agrupación
  por rejilla según el zoom y filtros por tipo y por estado.
- **d)** "Mi colonia": abiertos, resueltos del mes, y tiempo y cumplimiento
  **comparados con el promedio municipal**, que es lo que le dice al vecino si
  su colonia va rezagada.
- **e)** Las siete gráficas, cada una con descarga en CSV.
- **f)** Galería de antes y después, solo con reportes moderados.
- **g)** Datos abiertos en CSV y JSON, con diccionario de datos.

Además `/privacidad`, que estaba enlazada desde el pie y el formulario sin
existir.

### Validación

**Pruebas** — `npm test`, 28 suites, 0 fallos (3 nuevas)
- KPIs: el cumplimiento del resumen cuadra con la suma por categoría, la tasa
  de vencidos se mide sobre abiertos, todos los porcentajes caen entre 0 y 100,
  las series mensuales comparten los mismos meses sin huecos ni repetidos, y la
  puntualidad mensual suma exactamente los resueltos del periodo.
- Datos abiertos: el dataset publica **exactamente** las columnas del
  diccionario, no incluye ningún campo parecido a un dato personal, las
  coordenadas van redondeadas y las fechas salen sin hora.
- CSV: escapado de comas, comillas y saltos de línea, y BOM para Excel.

**En el navegador**
- Las siete secciones presentes, siete gráficas con sus siete botones de CSV,
  mapa cargado y las doce promesas de servicio en tabla.
- "Mi colonia" Centro: 4.1 días contra 3.7 del municipio, 67% de cumplimiento
  contra 78% — la comparación se lee de un vistazo.
- El dataset público verificado contra fugas: descripción, dirección exacta,
  nombre y las tres variantes del teléfono, ninguna aparece en CSV ni en JSON.

### Correcciones que salieron de construir esto
- **C-12**: el seed de un solo periodo dejaba vacías todas las comparaciones
  del §6.8. Se sembraron 12 meses previos. De paso salieron dos defectos de
  realismo: el 99% de los reportes abiertos aparecía vencido, y las reaperturas
  viejas nunca se resolvían.
- **C-13**: "sin teléfonos ni nombres" no alcanza para anonimizar un dataset.
- **D-11**: reabrir un reporte ahora reinicia el plazo.

---

## Fase 3 — Bots de WhatsApp y Telegram ✅

Telegram no está en el SPEC: lo pidió el equipo. Encajó sin tocar el motor
conversacional, que es exactamente lo que el §8 buscaba al exigir mensajería
tras una interfaz intercambiable.

### Hecho

**Mensajería intercambiable** — `src/lib/mensajeria/`
- `MessagingProvider` con tres implementaciones: WhatsApp Cloud API, Telegram y
  el simulador de desarrollo. El motor del bot no sabe cuál está usando.
- Cada proveedor resuelve las mañas de su canal: WhatsApp acepta máximo 3
  botones de 20 caracteres (Meta responde 400 si te pasas), Telegram no tiene
  ese límite y sí tiene teclado nativo para compartir ubicación y teléfono.
- Descarga de fotos: en Telegram, dos llamadas; en WhatsApp, pedir la URL
  temporal del medio y luego bajarla.

**Clasificador de IA** — `src/lib/ia/`
- Llamada a la API de Anthropic con **structured outputs**, no pidiendo JSON por
  prompt: el esquema lo aplica el servidor y no hay que parsear a ciegas.
- El prompt vive versionado en `prompts/clasificador.ts` para que un cambio de
  redacción se vea en el historial de git.
- **Siempre hay respaldo**: sin llave, con la API caída, con confianza baja o
  con una categoría inexistente, el bot cae al menú tradicional. Cada
  clasificación queda auditada con el motivo.
- El prompt le pide bajar la confianza en vez de adivinar, y advierte que el
  texto del ciudadano es contenido a clasificar, no instrucciones.

**Motor conversacional** — `src/lib/ia/bot.ts`
- Máquina de estados con el estado en la base, no en memoria: un bot que olvida
  en qué paso iba cada vez que se reinicia el servidor es inservible.
- El flujo del SPEC §4.1 completo: menú, alta con lenguaje natural, confirmación
  de categoría, foto, ubicación, detección de duplicados con oferta de adhesión,
  confirmación y folio con promesa de servicio. Más consulta de folio y
  escalamiento a humano.
- **Emergencias**: además del clasificador hay una lista de palabras clave que
  escala por sí sola. Las dos se suman, nunca se restan.

**Notificaciones salientes** — conectadas al ciclo de vida
- Asignado, resuelto (con petición de calificación), reabierto e improcedente.
- Fuera de la transacción: un proveedor caído no puede tumbar la transición que
  las disparó. Cada intento queda en la bitácora, entregado o no.

**Webhooks y simulador**
- `/api/webhooks/whatsapp` (con el reto de verificación de Meta) y
  `/api/webhooks/telegram` (protegido con secreto: Telegram no firma).
- `/dev/bot`: chat completo contra el motor real, solo en desarrollo.

### Validación

**Pruebas** — `npm test`, 31 suites, 0 fallos (5 nuevas)
- Emergencias: reconoce riesgo real, **no** confunde un bache o una fuga con
  una emergencia, escala y da el número, y tras escalar deja de conducir.
- Alta completa: folio, promesa de servicio, coordenadas, canal de aviso.
- Cancelar no crea nada; una descripción demasiado corta pide más detalle.
- Interpretación de los tres canales, incluido un webhook vacío.

**Tres defectos que encontró la validación**
- **C-15**: deduplicar los reintentos de webhook **por texto** era incorrecto —
  en un menú, dos "1" seguidos son legítimos, y el bot se quedaba mudo a media
  conversación. La llave es el id del mensaje del canal.
- **C-14**: el enum `origen` no tenía `telegram`, así que esos reportes se
  habrían contado como WhatsApp en la gráfica de canales del tablero.
- **C-16**: al conectar los avisos, quien reportaba por la web nunca se
  enteraba de nada — el canal de notificación solo lo fijaba el bot.

### Pendiente de la fase
- Credenciales de ambos bots (`PENDIENTES.md` §4). El de Telegram se da de alta
  en cinco minutos con @BotFather; el de WhatsApp requiere cuenta de Meta
  Business.
- El clasificador de IA está escrito y probado en su camino de respaldo, pero
  **no se ha ejercido contra la API real** por no haber `ANTHROPIC_API_KEY` en
  esta máquina.

---

## Fase 5 — Tablero ejecutivo y alertas ✅

**Entregable pedido:** métricas internas, embudo del bot, alertas por umbral.

### Hecho

**Alertas internas** — `src/lib/alertas.ts`, `/api/cron/alertas`
Las tres condiciones del SPEC §4.5: vencidos sobre el umbral, caída de más de
0.5 estrellas en una semana, y 3 o más reaperturas de una misma categoría en el
mes. Dos decisiones que separan una alerta útil del ruido:

- **No se repiten.** Mientras una siga abierta no se crea otra igual. Un cron
  cada 15 minutos que reenvía el mismo correo 96 veces al día consigue que la
  gente lo filtre, y entonces la alerta deja de servir.
- **Se cierran solas** cuando la condición deja de cumplirse.

La de calificación exige al menos 5 calificaciones en la semana: con dos o tres,
cualquier promedio se mueve solo y alertar por eso sería ruido garantizado.

El correo sale por SMTP si el municipio lo configura; si no, la alerta igual se
detecta, se guarda y se ve en el tablero. Un sistema de alertas que se cae
porque el servidor de correo no responde es peor que no tener correo.

**Tablero ejecutivo** — `/ejecutivo`
- Banner de alertas activas, resumen con comparación, y **tiempo de primera
  respuesta** (del alta al primer movimiento real, sacado de la bitácora).
- Desglose por dependencia, incluida la columna «recibidos de otra área»: si un
  área recibe muchas reasignaciones, el problema está en cómo se clasifica al
  entrar, no en ella.
- Ranking por cuadrilla, **con una advertencia visible** de que mide personas
  sin contexto y sirve para saber dónde hace falta apoyo, no para calificar.
- Embudo del bot: conversaciones → reportes → escaladas, más cuántas cayeron al
  menú de respaldo.
- Reaperturas por categoría, que es la señal más directa de trabajo mal cerrado.

### Validación

**Pruebas** — 34 suites, 0 fallos (3 nuevas)
- La alerta se dispara al rebasar el umbral, **no se repite** en la siguiente
  pasada, y **se cierra sola** cuando la condición desaparece.
- Con umbrales altos no inventa alertas; las reaperturas generan una alerta por
  categoría, no una global.
- Métricas internas coherentes: los vencidos son subconjunto de los abiertos,
  nadie resuelve más de lo asignado, ninguna primera respuesta es negativa, y
  el embudo del bot nunca pasa del 100%.

**En el navegador**, con perfil de supervisión: la alerta de vencidos aparece en
rojo con su cifra («20 de 84, 23.8%, el umbral es 20%»), primera respuesta 7.6 h,
y el embudo muestra 287 conversaciones con 79.1% que terminaron en reporte.

**Un defecto corregido:** los umbrales se leían al importar el módulo, así que
cambiarlos exigía reiniciar el servidor y no se podían probar sin trucos con la
caché de módulos. Ahora se leen en cada evaluación.

---

## Fase 6 — Endurecimiento ⏳ siguiente

Cabeceras de seguridad, revisión de privacidad y cierre de documentación.
