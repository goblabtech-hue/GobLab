# Decisiones de diseño

Registro de las decisiones no especificadas en `SPEC.md` y de las correcciones
aplicadas al propio spec. Regla que sigue este documento (SPEC §Notas finales):
*si algo no está especificado, se decide a favor del ciudadano (simplicidad) y
se deja anotado aquí.*

Las entradas `C-nn` son **correcciones al spec**: puntos donde seguirlo al pie
de la letra habría producido un sistema incorrecto. Las `D-nn` son decisiones
libres.

---

## Correcciones al spec

### C-01 · `Categoria.requiereEvidencia` no existía
El SPEC §5 dice, en las reglas de negocio: *"Un reporte `resuelto` sin foto de
evidencia es un error de validación (excepto categorías marcadas
`requiereEvidencia = false`)"*, pero la entidad `Categoria` de esa misma
sección no declara el campo. **Se agregó** (`Boolean @default(true)`), y las
"solicitudes de información" del seed lo traen en `false`.

### C-02 · `Colonia` no tenía `slug`, y la ruta lo exige
El SPEC §9 define la ruta `/mi-colonia/[slug]` pero la entidad `Colonia` del
§5 solo tiene `id`, `nombre` y `geojson`. **Se agregó `slug` único**, generado
al crear la colonia. Se prefirió slug sobre id numérico porque la URL de "Mi
colonia" es para compartirse entre vecinos: `/mi-colonia/nueva-esperanza` se
entiende, `/mi-colonia/17` no.

### C-03 · La tabla de días festivos nunca se declaró
El SPEC §5 exige calcular la fecha límite *"saltando sábados, domingos y días
festivos (tabla de festivos configurable)"*, pero esa tabla no aparece en el
modelo de datos. **Se agregó `DiaFestivo`**, administrable desde
`/admin/festivos`, precargada con los festivos oficiales de la Ley Federal del
Trabajo (art. 74) para el año anterior, el actual y el siguiente.

### C-04 · La "secuencia anual" de folios era una condición de carrera
El SPEC §5 pide *"El folio se genera con secuencia anual por municipio"* sin
decir cómo. La implementación natural —`COUNT(*)` o `MAX(folio)` del año— falla
en cuanto llegan dos reportes al mismo tiempo, que es exactamente lo que pasa
con WhatsApp y web operando en paralelo: ambos calculan el mismo número y el
segundo `INSERT` revienta contra el índice único de `folio`.

**Se agregó la tabla `FolioSecuencia`** y el folio se reserva con un
`INSERT … ON CONFLICT DO UPDATE … RETURNING`, que Postgres serializa sobre la
fila. La reserva ocurre dentro de la misma transacción que crea el reporte,
para que un rollback no queme un número de folio.

### C-05 · "Teléfono cifrado" era incompatible con buscar por teléfono
El SPEC §5 pide guardar el teléfono *"cifrado/enmascarado en vistas públicas"*,
y el §4.1 pide que el bot pueda *"buscar los reportes ligados a ese teléfono"*.
Ambas cosas juntas no funcionan: un cifrado autenticado produce texto distinto
cada vez, así que no se puede consultar por igualdad. Además, la lista de
variables de entorno del §9 no incluye ninguna llave de cifrado.

**Se guardan tres derivados** (`src/lib/telefono.ts`):

| Campo | Qué es | Para qué |
|---|---|---|
| `telefonoHash` | HMAC-SHA256, determinista | buscar por teléfono sin descifrar |
| `telefonoCifrado` | AES-256-GCM | descifrar solo para rol operador+ |
| `telefonoMascara` | `81••••1212` | listas internas sin descifrar nada |

Se agregó `PHONE_ENCRYPTION_KEY` a `.env.example`. Ninguno de los tres sale
jamás por un endpoint público.

### C-06 · Los agregados precalculados no tenían dónde vivir
El SPEC §7 exige *"agregados precalculados (vista materializada o tabla de
resumen refrescada cada 15 min)"* pero el modelo de datos no incluye ninguna.
**Se agregó `ResumenIndicadores`** (clave → payload JSON + marca de tiempo).
Se eligió tabla sobre vista materializada porque el tablero mezcla métricas de
formas muy distintas y una sola vista no las cubre; además una tabla se puede
refrescar por partes.

### C-07 · Nada dispara el autocierre ni el refresco de agregados
El SPEC §4.3 exige cerrar automáticamente los reportes `resuelto` a los 3 días,
y el §7 refrescar agregados cada 15 minutos. No se define quién ejecuta esas
tareas. **Se expondrán endpoints `/api/cron/*` protegidos con `CRON_SECRET`**,
invocables desde Vercel Cron o un `crontab` del VPS. Se descartó un scheduler
en proceso porque no sobrevive al modelo serverless que el §7 contempla.

### C-08 · El modelo de IA `claude-sonnet-4-6` ya no existe
El SPEC §4.1 lo nombra explícitamente. **Se usa `claude-sonnet-5`**, con el id
en `ANTHROPIC_MODEL` para poder cambiarlo sin tocar código.

### C-09 · "Días hábiles" sin huso horario da resultados incorrectos
El SPEC §5 no dice en qué huso se cuentan los días hábiles. Contarlos en UTC
rompe en los extremos del día: un reporte creado el viernes a las 23:30 hora
del centro de México es sábado 05:30 UTC, así que el reloj del SLA arrancaría
un día tarde. **Toda la aritmética de `src/lib/sla.ts` opera sobre fechas
civiles en `MUNICIPIO_TZ`** (`America/Mexico_City` por omisión), no sobre
instantes UTC, incluida la conversión de vuelta a instante en los cambios de
horario de verano.

### C-10 · La distribución de orígenes del seed dejaba `ventanilla` en cero
El SPEC §11 pide *"orígenes 55% whatsapp / 30% web / 15% teléfono"*, que suma
100% y deja sin datos a `ventanilla`, pese a existir en el enum del §5 y ser un
canal del §4.1. Un canal con cero reportes haría que la gráfica de orígenes del
tablero se viera rota. **Se reparte 55 / 30 / 10 / 5.**

### C-11 · La conversión de hora local perdía los milisegundos
Encontrado por las pruebas de `sla.ts`, no por revisión a ojo. `desfaseTz`
comparaba un instante truncado al segundo (el formateador de `Intl` no da
milisegundos) contra otro que sí traía milisegundos, y ese sobrante se colaba
en el desfase. Resultado: toda fecha límite calculada como 23:59:59.999 se
guardaba como 00:00:00.998 **del día siguiente**, así que el vencimiento
mostrado al ciudadano estaba corrido un día. Se trunca también el instante de
referencia.

---

## Decisiones libres

### D-01 · Next.js 16 en vez de 14
El SPEC §8 pide "Next.js 14+". `create-next-app` instala hoy la 16.3, que
cumple. Trae dos cambios que afectan al código: `middleware.ts` se llama ahora
`proxy.ts` y debe exportar una función, y los tipos `LayoutProps` se generan al
compilar.

### D-02 · Postgres también en desarrollo, sin doble target con SQLite
El SPEC §8 permite SQLite en desarrollo "con el mismo esquema". Se descartó:
mantener dos motores obliga a renunciar a `Json`, a los enums nativos y a
`ON CONFLICT`, que son justo las piezas de las que dependen el folio atómico
(C-04) y la línea de tiempo. La máquina de desarrollo ya corre Postgres 18 y el
`README` documenta cómo crear la base en un comando.

### D-03 · Prisma fijado a 7.10.0 estable
La etiqueta `latest` de `prisma` apunta hoy a `8.0.0-rc.13`, un release
candidate, y `npm install` dejaba el CLI en la 8 y el cliente en la 7. Ambos
paquetes están fijados con `-E` a 7.10.0. Quedan 4 advertencias de `npm audit`
en dependencias del CLI de Prisma (`deepmerge-ts`, `mysql2`): son de
herramientas de desarrollo, `mysql2` ni siquiera se usa, y `npm audit fix
--force` regresaría al release candidate.

### D-04 · Auth.js v5 con sesión JWT, y el permiso por rol en el servidor
El SPEC §8 nombra NextAuth/Auth.js. La v5 (beta) declara soporte de Next 16, así
que se usa. El `proxy.ts` solo decide "hay sesión o no"; **el permiso por rol se
aplica en el servidor**, en el layout de cada sección (`guardarSeccion`), para
que llegar por URL directa a una sección ajena no la abra.

Los callbacks `jwt` y `session` viven en `auth.config.ts`, no en `auth.ts`: el
proxy crea su propia instancia de NextAuth y sin ellos el objeto de sesión que
recibe no trae `rol`.

Entrar a una sección sin permiso **muestra un mensaje**, no rebota al login:
rebotar haría creer al usuario que su contraseña falló.

### D-08 · La sesión se recontrasta contra la base en cada carga interna
La sesión es un JWT firmado que vive 8 horas y no consulta la base. Eso hacía
falsa la promesa de la propia pantalla de administración ("desactivar una
cuenta le quita el acceso"): la persona seguía entrando hasta que su token
expirara, y un cambio de perfil tampoco surtía efecto.

`guardarSeccion` ahora consulta la cuenta por id en cada carga de sección
interna y usa el rol **de la base**, no el del token. Si la cuenta está dada de
baja o borrada, se cierra la sesión con una explicación en `/entrar`. Es una
consulta por clave primaria; el costo es despreciable frente a tener permisos
que tardan 8 horas en aplicarse.

### D-05 · Tema claro fijo
El tablero público se proyecta en pantallas y se imprime. Un tema oscuro
automático haría impredecible el contraste que exige WCAG 2.1 AA (SPEC §7), así
que `color-scheme` queda en `light`.

### D-06 · Mensaje de error único al iniciar sesión
"Correo o contraseña incorrectos" en ambos casos, y se compara siempre contra
un hash señuelo cuando el correo no existe. Decir "ese correo no existe"
permitiría enumerar las cuentas del municipio.

### D-07 · Identificadores en español
El dominio es municipal mexicano y el SPEC exige que toda la interfaz esté en
español. Mantener el código en el mismo idioma que el dominio evita la
traducción mental constante (`reporte`/`report`, `folio`/`tracking number`).
