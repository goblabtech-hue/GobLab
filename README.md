# Plataforma de Atención Ciudadana Municipal

Reportes ciudadanos de punta a punta: captación por web y WhatsApp, triaje y
ruteo, resolución con evidencia fotográfica, calificación del ciudadano y un
tablero público con datos abiertos.

La especificación completa está en [`SPEC.md`](SPEC.md). Las decisiones de
diseño y las correcciones al spec, en [`DECISIONES.md`](DECISIONES.md). Lo que
falta llenar con datos reales del municipio, en [`PENDIENTES.md`](PENDIENTES.md).
El avance por fases, en [`PROGRESO.md`](PROGRESO.md).

---

## Levantarlo desde cero

Necesitas **Node 20+** y **PostgreSQL 14+** corriendo en local.

```bash
# 1. Dependencias
npm install

# 2. Base de datos
createdb atencion_ciudadana

# 3. Variables de entorno
cp .env.example .env

# 4. Secretos (pega cada resultado en su variable del .env)
openssl rand -base64 32   # AUTH_SECRET
openssl rand -base64 32   # PHONE_ENCRYPTION_KEY
openssl rand -base64 32   # CRON_SECRET

# 5. Ajusta DATABASE_URL en .env con tu usuario de Postgres
#    postgresql://TU_USUARIO@localhost:5432/atencion_ciudadana?schema=public

# 6. Esquema
npx prisma migrate dev

# 7. Datos de demostración (400 reportes en 13 meses)
npx prisma db seed

# 8. Arrancar
npm run dev
```

Abre <http://localhost:3000>.

> **Sin `ANTHROPIC_API_KEY` el sistema funciona igual.** El clasificador de IA
> del bot cae al menú de categorías tradicional, como pide el SPEC §4.1.

## Cuentas de demostración

Las crea el seed. Todas usan la contraseña **`Demo1234!`**.

| Perfil | Correo | Entra a |
|---|---|---|
| Administración | `admin@municipio.gob.mx` | Todo |
| Supervisión | `supervisor@municipio.gob.mx` | Indicadores, bandeja, cuadrilla |
| Atención ciudadana | `operador@municipio.gob.mx` | Bandeja |
| Cuadrilla | `cuadrilla@municipio.gob.mx` | Sus reportes asignados |

**Bórralas antes de producción.** Ver `PENDIENTES.md`.

## Los bots

El sistema habla por **WhatsApp** y por **Telegram**, y trae un **simulador**
para probar el flujo completo sin credenciales de nadie:

```
http://localhost:3000/dev/bot
```

Escríbele como le escribirías a una persona («hay un bache enorme frente a la
escuela») y te lleva hasta el folio. Prueba también con «huele a gas»: el bot
debe mandarte al número de emergencias y dejar de intentar resolverlo.

Sin `ANTHROPIC_API_KEY` el bot funciona igual: en vez de entender lenguaje
natural, muestra el menú de categorías. Ese respaldo es parte del diseño, no una
limitación temporal.

Para conectar los bots de verdad, ver `PENDIENTES.md` §4.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npx prisma studio` | Explorador visual de la base |
| `npx prisma db seed` | Regenera los datos de demostración (borra los existentes) |
| `npx prisma migrate dev` | Aplica cambios del esquema |

El seed es **reproducible**: usa un generador con semilla fija, así que dos
corridas producen exactamente los mismos 400 reportes.

## Cómo está organizado

```
prisma/
  schema.prisma     modelo de datos
  seed.ts           datos de demostración
  catalogos.ts      categorías, dependencias, colonias, festivos
src/
  app/
    (interno)/      bandeja, cuadrilla, ejecutivo, admin  (requieren sesión)
    entrar/         login del personal municipal
  lib/
    sla.ts          días hábiles y fecha límite
    folio.ts        folio único con secuencia anual atómica
    telefono.ts     hash + cifrado + máscara del teléfono de contacto
    duplicados.ts   detección por cercanía (Haversine)
    presentacion.ts lenguaje ciudadano de cada estatus
  components/ui/    botones, campos, tarjetas, insignias, alertas
```

## Tareas programadas

Dos procesos tienen que correr solos. En un servidor propio, con `crontab`:

```
# cierra reportes resueltos sin calificar tras 3 días — una vez al día
0 3 * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/autocierre

# limpieza de ventanas del limitador — cada 15 minutos
*/15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/mantenimiento

# refresca los agregados del tablero público — cada 15 minutos
*/15 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://TU-DOMINIO/api/cron/indicadores
```

En Vercel, las mismas rutas se declaran en `vercel.json` con `crons`. Sin
`CRON_SECRET` los endpoints responden 401 siempre.

El tablero no depende de que esto corra: si el resumen tiene más de 15 minutos
se recalcula solo en la siguiente visita. La tarea programada existe para que
ese costo no se lo lleve un ciudadano.

## Notas de operación

- **El teléfono del ciudadano se guarda cifrado** (AES-256-GCM) y solo se
  descifra para los perfiles de operador, supervisión y administración. Si
  pierdes `PHONE_ENCRYPTION_KEY`, esos teléfonos son irrecuperables.
- **Los días festivos cambian las fechas límite.** Editarlos en `/admin/festivos`
  afecta a los reportes nuevos; los existentes conservan su fecha.
- **Ningún endpoint público expone teléfono ni nombre**, ni siquiera el CSV de
  datos abiertos.
