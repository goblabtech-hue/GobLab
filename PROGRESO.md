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

### Verificado en el navegador
- Login como `operador` → aterriza en `/bandeja`; la nav solo muestra su sección.
- `/admin` y `/ejecutivo` por URL directa con rol `operador` → bloqueados con
  mensaje, sin rebote al login.
- Login como `admin` → ve las cuatro secciones.
- Edición real: promesa de "Bache" 5 → 7 días hábiles, persistió; revertida.

### Pendiente de la fase
- Los datos del municipio siguen siendo de demostración → `PENDIENTES.md`.

---

## Fase 2 — Ciclo del reporte (web) ⏳ siguiente

Crear reporte web, folio, SLA, bandeja interna, asignación, vista cuadrilla,
cierre con evidencia, calificación y reapertura.
