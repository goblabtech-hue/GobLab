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

## Fase 3 — Bot de WhatsApp ⏳ siguiente

Simulador, flujo conversacional, clasificador de IA con respaldo por menú,
webhook real detrás de `MessagingProvider`, notificaciones de estatus.
