# PROMPT PARA CLAUDE CODE — Plataforma de Atención Ciudadana Municipal

> **Instrucción de uso:** Copia este documento completo y pégalo como prompt inicial en Claude Code (o guárdalo como `SPEC.md` en la raíz del repositorio y pide a Claude Code que lo lea y ejecute el plan de implementación de la sección 12). Sustituye los valores entre `{{LLAVES}}` antes de empezar.

---

## 1. Contexto del proyecto

Eres el desarrollador principal de una plataforma integral de atención ciudadana para el municipio de **{{NOMBRE_MUNICIPIO}}**, un municipio pequeño de México (~{{POBLACION}} habitantes, ~{{NUM_COLONIAS}} colonias, {{NUM_DEPENDENCIAS}} dependencias/direcciones municipales).

El proyecto toma como referencia el sistema del municipio de San Pedro Garza García, N.L. (chatbot "Sam Petrino" + portal indicadores.sanpedro.gob.mx), reconocido con el Premio a la Innovación en Transparencia 2020 del INAI, pero busca **superarlo** corrigiendo sus debilidades detectadas:

| Debilidad de San Pedro | Cómo la superamos |
|---|---|
| Tres sistemas fragmentados (PHP + ASP.NET legado + Next.js) con navegación inconsistente | Una sola plataforma moderna, monorepo, diseño unificado |
| Tablero con lenguaje burocrático (secretarías, direcciones, "reasignados") | Lenguaje ciudadano: categorías por tipo de problema ("baches", "alumbrado", "basura") |
| Mapa aislado en un iframe a sistema legado | Mapa integrado como vista principal con capas y filtros |
| Sin vista geográfica por colonia | Módulo "Mi colonia" con estadísticas hiperlocales |
| No publica tiempos de resolución por tipo de problema | "Promesas de servicio" públicas con cumplimiento real vs. compromiso |
| Evidencia fotográfica de resolución existe pero no se muestra al público | Galería pública de "antes / después" (con moderación) |
| Encuesta de satisfacción desactualizada (última: 2023) | Evaluación continua integrada al cierre de cada reporte |
| Solo desktop-first | Mobile-first (la mayoría de usuarios entra desde celular) |

**Lo que sí conservamos de San Pedro (sus aciertos):**
- Medir el ciclo completo, incluyendo los indicadores incómodos: reportes vencidos y reasignados.
- Comparación automática de cada métrica contra el periodo anterior.
- Descarga de datos abiertos desde cada gráfica.
- Folio único por reporte, consultable por el ciudadano.
- Cierre de reportes con evidencia fotográfica obligatoria por parte de cuadrillas.
- Calificación del ciudadano al cierre como métrica principal de éxito.
- Canal principal: WhatsApp (el medio que la gente ya usa).

## 2. Objetivo

Construir una plataforma web (con integración a WhatsApp) que cubra el **ciclo completo de atención ciudadana en 5 fases**:

1. **Captación unificada** — todos los canales (WhatsApp, web, teléfono capturado por operador, ventanilla) entran al mismo sistema y generan un folio único.
2. **Triaje y ruteo** — clasificación por categoría, prioridad y dependencia responsable; detección de duplicados; asignación automática.
3. **Resolución trazable** — las cuadrillas reciben, atienden y cierran con evidencia fotográfica.
4. **Cierre con el ciudadano** — notificación de resolución + calificación de 1 a 5 estrellas.
5. **Datos abiertos y mejora continua** — tablero público en tiempo real, datasets descargables, alertas internas de degradación del servicio.

## 3. Usuarios y roles

| Rol | Descripción | Acceso |
|---|---|---|
| **Ciudadano** (sin cuenta) | Crea reportes por WhatsApp o web, consulta su folio, ve el tablero público, califica la atención | Público, sin login. Identificado por teléfono + folio |
| **Operador de atención** | Captura reportes telefónicos/ventanilla, responde conversaciones escaladas del bot, reasigna | Login, rol `operador` |
| **Cuadrilla / resolutor** | Ve reportes asignados a su área, cambia estatus, sube evidencia de resolución | Login, rol `cuadrilla` (vista móvil simplificada) |
| **Supervisor de dependencia** | Ve tablero interno de su dependencia, reasigna dentro de su área, valida cierres | Login, rol `supervisor` |
| **Administrador** | Gestión de catálogos (categorías, colonias, dependencias, usuarios, promesas de servicio), tablero ejecutivo completo | Login, rol `admin` |

## 4. Módulos funcionales (detalle completo)

### 4.1 Módulo de captación — Reporte ciudadano

**Canal web (público, mobile-first):**
- Formulario de nuevo reporte: categoría (selector visual con íconos), descripción libre, hasta 3 fotos, ubicación (mapa con pin arrastrable + autodetección GPS + selector de colonia como respaldo), teléfono de contacto (opcional pero recomendado para notificaciones), nombre (opcional).
- Al enviar: genera folio con formato `{{PREFIJO}}-AAAA-NNNNN` (ej. `TIZ-2026-00341`), muestra pantalla de confirmación con folio, promesa de servicio de esa categoría ("Los baches se atienden en un máximo de 5 días hábiles") y liga para dar seguimiento.
- Página de consulta de folio: estatus actual, línea de tiempo del reporte (creado → asignado → en atención → resuelto → cerrado), evidencia de resolución cuando exista, y botón de calificación al cierre.

**Canal WhatsApp (bot con IA):**
- Integración con **Meta WhatsApp Cloud API** (webhook + envío). En desarrollo, implementar un **simulador de WhatsApp** (página interna `/dev/whatsapp` que emula la conversación) para no depender de credenciales reales; la integración real queda detrás de una interfaz `MessagingProvider` intercambiable.
- Flujo conversacional del bot:
  1. Saludo + menú: 1) Nuevo reporte, 2) Consultar folio, 3) Información del municipio, 4) Hablar con una persona.
  2. Nuevo reporte: pide descripción en lenguaje natural → el clasificador de IA propone categoría → confirma con el ciudadano → pide foto (opcional) → pide ubicación (ubicación de WhatsApp, o texto de calle y colonia) → confirma resumen → genera folio y responde con promesa de servicio.
  3. Consultar folio: pide folio o busca los reportes ligados a ese teléfono → devuelve estatus y línea de tiempo.
  4. Escalamiento: palabras clave de emergencia (fuga, incendio, violencia, accidente) o solicitud explícita → marca la conversación para atención humana y notifica a operadores; NUNCA intenta resolver emergencias por bot: responde con los teléfonos de emergencia ({{TEL_EMERGENCIAS}}).
- **Clasificador de IA:** usar la API de Anthropic (`claude-sonnet-4-6` vía `/v1/messages`) con un prompt de clasificación que devuelva JSON estricto: `{ "categoria_id": ..., "prioridad": "normal|alta|urgente", "es_emergencia": bool, "colonia_detectada": ..., "resumen": ... }`. La llave se lee de `ANTHROPIC_API_KEY` en variables de entorno. Implementar fallback: si la API falla o no hay llave, el bot usa menú de categorías tradicional. Registrar cada clasificación para auditoría.
- Notificaciones salientes por WhatsApp al ciudadano en cada cambio de estatus relevante (asignado, resuelto con foto, solicitud de calificación).

**Canal operador (teléfono/ventanilla):**
- Pantalla interna de captura rápida con los mismos campos, que registra `origen = telefono | ventanilla`.

### 4.2 Módulo de triaje y gestión interna

- Bandeja de reportes con filtros por estatus, categoría, colonia, dependencia, prioridad, fecha y origen; búsqueda por folio y texto.
- Asignación automática: cada categoría tiene una dependencia responsable por defecto (catálogo administrable); el reporte nace asignado.
- **Detección de duplicados:** al crear un reporte, buscar reportes abiertos de la misma categoría en un radio de 100 m (configurable) en los últimos 30 días; si hay coincidencia, ofrecer ligar el nuevo reporte como "adhesión" al existente (el ciudadano suma su teléfono a las notificaciones de ese reporte). Los reportes con más adhesiones suben de prioridad.
- Reasignación entre dependencias con motivo obligatorio (esto alimenta el KPI de "reasignados", señal de mal ruteo).
- Semáforo de vencimiento: cada categoría tiene un SLA (promesa de servicio) en días hábiles; el sistema calcula fecha límite y marca verde / ámbar (≤1 día para vencer) / rojo (vencido).
- Estatus del ciclo de vida: `nuevo → asignado → en_atencion → resuelto → cerrado`, más estados especiales `duplicado`, `improcedente` (con motivo público), `reabierto` (si el ciudadano califica ≤2 estrellas y lo solicita, regresa a `en_atencion` una sola vez).

### 4.3 Módulo de resolución (vista cuadrilla)

- Vista móvil simplificada: lista "Mis reportes de hoy" ordenada por vencimiento y cercanía.
- Detalle con mapa, fotos del ciudadano y botón "Marcar como resuelto" que **exige** al menos 1 foto de evidencia y permite nota de cierre.
- Al marcar resuelto: notificación automática al ciudadano con la foto de evidencia y solicitud de calificación; el reporte pasa a `resuelto` y se cierra automáticamente (`cerrado`) a los 3 días si el ciudadano no responde, o inmediatamente al calificar.

### 4.4 Tablero público (el corazón del proyecto — debe superar a indicadores.sanpedro.gob.mx)

Página pública sin login, mobile-first, con lenguaje ciudadano. Secciones:

**a) Resumen de los últimos 12 meses (hero):**
- Reportes recibidos, reportes resueltos, % resuelto dentro de la promesa de servicio, calificación promedio ciudadana (estrellas). Cada cifra con variación vs. periodo anterior.

**b) Promesas de servicio (diferenciador clave):**
- Tabla/cards por categoría: "Bache — promesa: 5 días hábiles — cumplimiento este mes: 92% — tiempo promedio real: 3.2 días". Verde si cumplimiento ≥90%, ámbar 70–89%, rojo <70%. Esto NO existe en San Pedro y es el contrato público con la ciudadanía.

**c) Mapa integrado (no en página aparte):**
- Mapa del municipio con clusters de reportes; capas por categoría y por estatus (abiertos/resueltos); filtro por periodo. Usar Leaflet + OpenStreetMap (gratuito, sin llaves de Google).

**d) Mi colonia (diferenciador clave):**
- Selector de colonia → reportes activos, resueltos del mes, tiempo promedio de resolución en esa colonia, y comparación con el promedio municipal.

**e) Gráficas de detalle (equivalentes a San Pedro, con mejor lenguaje):**
- Reportes por categoría (no "por secretaría"), evolución mensual, estatus, vencidos, origen del reporte (WhatsApp / web / teléfono / ventanilla), reasignados, y distribución de calificaciones. Cada gráfica con botón de descarga CSV.

**f) Galería antes/después (diferenciador clave):**
- Cards con foto del reporte y foto de la resolución, categoría, colonia y días que tomó. Solo reportes marcados como "publicables" por un supervisor (moderación para evitar datos personales en fotos).

**g) Datos abiertos:**
- Endpoint público `/api/datos-abiertos/reportes.csv` (y `.json`) con el dataset anonimizado (sin teléfonos ni nombres), actualizado en tiempo real, + página que documenta el diccionario de datos.

### 4.5 Tablero interno (ejecutivo)

- Todo lo del público más: desglose por dependencia y por usuario resolutor, tiempos de primera respuesta, reportes reabiertos, ranking de cuadrillas, embudo del bot (conversaciones iniciadas → reportes generados → escaladas a humano), y alertas automáticas (banner + correo) cuando: % vencidos > umbral, calificación promedio semanal cae > 0.5 estrellas, o una categoría acumula 3+ reabiertos en el mes. (Esta es la lección de San Pedro 2021: el sistema debe avisar cuando se degrada, no esperar a que alguien lo note.)

## 5. Modelo de datos (Prisma / PostgreSQL)

Entidades mínimas (agrega campos de auditoría `createdAt/updatedAt` a todas):

- **Reporte**: id, folio (único), categoriaId, descripcion, prioridad, estatus, origen (whatsapp|web|telefono|ventanilla), lat, lng, direccionTexto, coloniaId, telefonoContacto (cifrado/enmascarado en vistas públicas), nombreContacto?, dependenciaId (asignada), fechaLimite, resueltoAt?, cerradoAt?, calificacion?, comentarioCalificacion?, publicable (bool, default false), reporteOriginalId? (para duplicados/adhesiones), motivoImprocedente?
- **FotoReporte**: id, reporteId, url, tipo (ciudadano|evidencia), subidaPorUserId?
- **EventoReporte** (línea de tiempo/auditoría): id, reporteId, tipo (creado|asignado|reasignado|comentario|resuelto|cerrado|reabierto|notificacion), detalle (JSON), userId?, timestamp
- **Categoria**: id, nombre ciudadano, icono, dependenciaId default, slaDiasHabiles, activa
- **Dependencia**: id, nombre, responsable, telefono
- **Colonia**: id, nombre, geojson? (polígono opcional; si no hay, se asigna por selector)
- **Usuario**: id, nombre, email, hashPassword, rol (operador|cuadrilla|supervisor|admin), dependenciaId?
- **ConversacionBot**: id, telefono, estado del flujo (JSON), escaladaAHumano (bool), reporteId?, mensajes[] (**MensajeBot**: dirección in/out, texto, mediaUrl?, timestamp)
- **Adhesion**: id, reporteId, telefono, createdAt
- **PromesaServicioHistorial**: snapshot mensual por categoría (cumplimiento %, tiempo promedio) para las gráficas históricas

Reglas de negocio críticas:
- El folio se genera con secuencia anual por municipio.
- `fechaLimite` = fecha creación + slaDiasHabiles de la categoría, saltando sábados, domingos y días festivos (tabla de festivos configurable).
- Nunca exponer teléfono ni nombre en endpoints públicos ni en el CSV de datos abiertos.
- Un reporte `resuelto` sin foto de evidencia es un error de validación (excepto categorías marcadas `requiereEvidencia = false`, p. ej. solicitudes de información).

## 6. KPIs del sistema (fórmulas exactas)

1. % resuelto a tiempo = resueltos con `resueltoAt <= fechaLimite` / total resueltos del periodo.
2. Tiempo promedio de resolución por categoría = promedio de días hábiles entre creación y `resueltoAt`.
3. Calificación promedio = media de `calificacion` de reportes cerrados del periodo (mostrar también distribución 1–5).
4. Tasa de vencidos = reportes abiertos con `fechaLimite < hoy` / reportes abiertos.
5. Tasa de reasignación = reportes con ≥1 evento `reasignado` / total del periodo (proxy de mal ruteo).
6. Tasa de reapertura = reabiertos / cerrados (proxy de cierres falsos).
7. Efectividad del bot = reportes generados por WhatsApp / conversaciones iniciadas; y % escaladas a humano.
8. Todos los KPIs se calculan con comparación vs. periodo anterior equivalente.

## 7. Requisitos no funcionales

- **Mobile-first** en todo lo público y en la vista cuadrilla. Desktop-first solo en bandeja interna y tablero ejecutivo.
- **Accesibilidad**: WCAG 2.1 AA razonable (contraste, labels, navegación por teclado); lenguaje simple.
- **Español mexicano** en toda la interfaz; el bot responde también en inglés si el ciudadano escribe en inglés.
- **Privacidad**: aviso de privacidad visible (LGPDPPSO/estatal), teléfonos enmascarados internamente (`81••••1212`) salvo para operadores, fotos publicables solo tras moderación.
- **Rendimiento**: tablero público debe cargar < 3 s en 4G; usar agregados precalculados (vista materializada o tabla de resumen refrescada cada 15 min) en lugar de agregar sobre la tabla cruda en cada request.
- **Seguridad**: auth con sesiones httpOnly, rate limiting en endpoints públicos, validación de todos los inputs con Zod, sanitización de archivos subidos (solo imágenes, máx 10 MB, re-encode server-side).
- **Costo**: infraestructura pensada para presupuesto municipal pequeño — un solo servidor/VPS o plan hobby de Vercel + Postgres administrado + almacenamiento S3-compatible; sin dependencias de licencia.

## 8. Stack técnico requerido

- **Next.js 14+ (App Router) + TypeScript** — una sola app para sitio público, paneles internos y API routes.
- **PostgreSQL + Prisma** (en desarrollo puede usarse SQLite con el mismo esquema si simplifica el arranque, pero el target es Postgres).
- **Tailwind CSS + shadcn/ui** para UI consistente y rápida.
- **Leaflet + OpenStreetMap** para mapas (sin llaves de pago).
- **Recharts** para gráficas del tablero.
- **Zod** para validación, **NextAuth/Auth.js** (credenciales) para login interno.
- **Almacenamiento de imágenes**: interfaz `StorageProvider` con implementación local en dev (`/uploads`) y S3-compatible en producción.
- **Mensajería**: interfaz `MessagingProvider` con implementación `WhatsAppCloudProvider` (Meta Cloud API) y `SimuladorProvider` para desarrollo.
- **IA**: llamadas server-side a la API de Anthropic para clasificación y para las respuestas del bot en modo conversacional; prompts en archivos versionados en `/src/lib/ia/prompts/`.

## 9. Estructura del repositorio

```
/
├── SPEC.md                      # este documento
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                  # datos semilla (ver sección 11)
├── src/
│   ├── app/
│   │   ├── (publico)/
│   │   │   ├── page.tsx                 # landing: crear reporte + resumen
│   │   │   ├── reportar/                # formulario de nuevo reporte
│   │   │   ├── folio/[folio]/           # seguimiento + calificación
│   │   │   ├── tablero/                 # tablero público (secciones 4.4 a-g)
│   │   │   ├── mi-colonia/[slug]/
│   │   │   ├── antes-despues/
│   │   │   └── datos-abiertos/
│   │   ├── (interno)/
│   │   │   ├── bandeja/                 # triaje (operador/supervisor)
│   │   │   ├── cuadrilla/               # vista móvil resolutor
│   │   │   ├── ejecutivo/               # tablero interno + alertas
│   │   │   └── admin/                   # catálogos y usuarios
│   │   ├── dev/whatsapp/                # simulador de WhatsApp (solo NODE_ENV=development)
│   │   └── api/
│   │       ├── reportes/ ...            # CRUD + transiciones de estatus
│   │       ├── webhooks/whatsapp/       # webhook Meta Cloud API
│   │       ├── datos-abiertos/
│   │       └── indicadores/             # agregados para el tablero
│   ├── lib/
│   │   ├── ia/ (clasificador.ts, bot.ts, prompts/)
│   │   ├── mensajeria/ (provider.ts, whatsapp-cloud.ts, simulador.ts)
│   │   ├── storage/ (provider.ts, local.ts, s3.ts)
│   │   ├── sla.ts               # cálculo de días hábiles y fechaLimite
│   │   ├── folio.ts
│   │   └── duplicados.ts        # búsqueda por radio (Haversine)
│   └── components/
├── .env.example                 # TODAS las variables documentadas
└── README.md                    # setup en < 10 pasos
```

Variables de entorno (`.env.example`): `DATABASE_URL`, `ANTHROPIC_API_KEY`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `STORAGE_DRIVER=local|s3`, `S3_*`, `AUTH_SECRET`, `MUNICIPIO_NOMBRE`, `MUNICIPIO_PREFIJO_FOLIO`, `MUNICIPIO_CENTRO_LAT/LNG`, `TEL_EMERGENCIAS`.

## 10. Criterios de aceptación (definición de "terminado")

1. Un ciudadano puede crear un reporte desde el celular (web) en menos de 2 minutos, recibe folio y promesa de servicio, y puede consultar su avance sin cuenta.
2. En el simulador de WhatsApp, el flujo completo del bot funciona: reporte en lenguaje natural → clasificación por IA con confirmación → folio; consulta de folio; escalamiento a humano; y el fallback por menú funciona sin `ANTHROPIC_API_KEY`.
3. Una cuadrilla puede cerrar un reporte SOLO subiendo evidencia; el ciudadano recibe la notificación (simulada en dev) y puede calificar; calificar ≤2 permite reabrir una vez.
4. El tablero público muestra: resumen 12 meses, promesas de servicio con cumplimiento real, mapa con clusters y filtros, "Mi colonia", 7 gráficas con descarga CSV, galería antes/después solo con reportes moderados, y datos abiertos sin datos personales.
5. Reportes duplicados en un radio de 100 m se detectan y permiten adhesión.
6. El semáforo de vencimiento y las alertas internas disparan correctamente (probar con datos semilla que incluyan casos vencidos).
7. Ningún endpoint público expone teléfono o nombre. `npm run build` pasa sin errores. Seed + README permiten levantar todo desde cero.

## 11. Datos semilla (para demo realista)

Genera en `prisma/seed.ts`:
- 12 categorías: bache, luminaria apagada, fuga de agua, basura acumulada, árbol caído/riesgo, banqueta dañada, semáforo descompuesto, parque en mal estado, ruido/comercio irregular, animal en situación de calle, drenaje tapado, solicitud de información. Cada una con SLA (2–10 días hábiles) e ícono.
- 5 dependencias, {{NUM_COLONIAS}} colonias (usa nombres reales del municipio si se proporcionan; si no, genéricos), 8 usuarios (2 por rol).
- 400 reportes distribuidos en los últimos 12 meses con distribución realista: ~60% cerrados a tiempo, ~15% vencidos, ~8% reasignados, ~5% reabiertos, calificaciones sesgadas a 4–5 con cola de 1–2, orígenes 55% whatsapp / 30% web / 15% teléfono, coordenadas dentro de {{MUNICIPIO_CENTRO_LAT/LNG}} ± ruido, y ~30 pares de fotos antes/después publicables (usa imágenes placeholder generadas localmente).

## 12. Plan de implementación (ejecutar en este orden)

Trabaja por fases y verifica cada una antes de continuar (levanta el dev server, prueba los flujos, corre el build):

- **Fase 1 — Fundación:** scaffolding Next.js + Prisma + auth + catálogos + seed. Entregable: login por rol y admin de catálogos.
- **Fase 2 — Ciclo del reporte (web):** crear reporte web, folio, SLA/días hábiles, bandeja interna, asignación, vista cuadrilla, cierre con evidencia, calificación y reapertura. Entregable: ciclo de vida completo sin bot.
- **Fase 3 — Bot de WhatsApp:** simulador, flujo conversacional, clasificador IA con fallback, webhook real detrás de `MessagingProvider`, notificaciones de estatus, duplicados/adhesiones.
- **Fase 4 — Tablero público:** agregados precalculados, las 7 secciones (4.4 a–g), datos abiertos, mapa.
- **Fase 5 — Tablero ejecutivo y alertas:** métricas internas, embudo del bot, alertas por umbral.
- **Fase 6 — Endurecimiento:** rate limiting, sanitización de imágenes, pruebas de los módulos críticos (sla.ts, folio.ts, duplicados.ts, transiciones de estatus), revisión de privacidad, README final.

Al terminar cada fase, escribe un resumen breve de lo hecho y lo pendiente en `PROGRESO.md`.

## 13. Roadmap posterior al MVP (documentar, no implementar)

Presupuesto participativo ligado a colonias con más reportes; app PWA instalable; notificaciones por SMS como respaldo; integración con el sistema de nómina/órdenes de trabajo del municipio; encuesta semestral tipo NPS automatizada por WhatsApp; portal de transparencia con actas de cabildo; panel comparativo público mes contra mes por dependencia.

---

## Notas finales para Claude Code

- Prioriza que **cada fase quede funcional y demostrable** sobre completar todo a medias: este proyecto se presentará a autoridades municipales y necesita demos incrementales.
- Todo el texto visible al ciudadano debe estar en español claro y cálido, sin jerga burocrática ("Tu reporte de bache fue recibido", no "Su solicitud fue turnada a la dependencia competente").
- Si alguna decisión de diseño no está especificada aquí, decide a favor del ciudadano (simplicidad) y déjala registrada en `DECISIONES.md`.
- No inventes datos del municipio: usa los placeholders `{{...}}` y lístalos al inicio para que el equipo los complete.
