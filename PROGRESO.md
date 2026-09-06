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

## Fase 2 — Ciclo del reporte (web) ⏳ siguiente

Crear reporte web, folio, SLA, bandeja interna, asignación, vista cuadrilla,
cierre con evidencia, calificación y reapertura.
