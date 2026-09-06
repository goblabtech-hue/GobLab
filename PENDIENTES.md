# Pendientes del municipio

El SPEC (Notas finales) pide **no inventar datos del municipio**. Todo lo que
aparece abajo son **valores de demostración**: el sistema arranca y se puede
enseñar con ellos, pero hay que sustituirlos antes de salir a producción.

Ningún dato municipal está escrito en el código: todo se lee de variables de
entorno (`src/lib/config.ts`) o del catálogo administrable.

## 1. Variables de entorno — archivo `.env`

| Variable | Valor demo actual | Qué poner |
|---|---|---|
| `MUNICIPIO_NOMBRE` | `Municipio Demo` | Nombre oficial del municipio |
| `MUNICIPIO_PREFIJO_FOLIO` | `MUN` | 3 letras para el folio (`TIZ-2026-00341`) |
| `MUNICIPIO_CENTRO_LAT` | `19.4326` | Latitud del centro (centra el mapa) |
| `MUNICIPIO_CENTRO_LNG` | `-99.1332` | Longitud del centro |
| `MUNICIPIO_ZOOM_INICIAL` | `13` | Zoom inicial del mapa |
| `MUNICIPIO_TZ` | `America/Mexico_City` | Huso horario (define los días hábiles) |
| `TEL_EMERGENCIAS` | `911` | Número al que deriva el bot ante emergencias |

> Las cuatro variables `NEXT_PUBLIC_*` del `.env` deben quedar con el mismo
> valor que sus equivalentes: son el espejo que lee el mapa en el navegador.

**Ojo con el prefijo de folio:** cambiarlo después de que existan reportes
arranca una secuencia nueva. Los folios viejos conservan el prefijo anterior.

## 2. Catálogos — se editan en `/admin`, no en el código

| Catálogo | Estado | Qué falta |
|---|---|---|
| **Colonias** | 24 nombres genéricos | Sustituir por las colonias reales. `/admin/colonias` |
| **Dependencias** | 5 genéricas ("Dirección de Servicios Públicos"…) | Nombres reales, responsable y teléfono. `/admin/dependencias` |
| **Categorías** | Las 12 del SPEC §11 | Revisar que los plazos sean los que el municipio **puede** cumplir |
| **Días festivos** | Solo los oficiales (LFT art. 74) | Agregar los festivos locales (feria, fiestas patronales) |
| **Usuarios** | 8 cuentas de demo | Dar de alta al personal real y **borrar las de demo** |

### Las promesas de servicio son un compromiso público
Los plazos de `/admin/categorias` se publican en el tablero abierto y se miden
contra el cumplimiento real. Conviene que los defina quien opera cada
dependencia, no quien instala el sistema. Los plazos actuales (2 a 10 días
hábiles) son un punto de partida razonable, no una recomendación.

## 3. Seguridad — antes de producción

- [ ] `AUTH_SECRET`, `PHONE_ENCRYPTION_KEY` y `CRON_SECRET` se generaron para
      desarrollo. **Generar nuevos** en producción:
      `openssl rand -base64 32`
- [ ] `PHONE_ENCRYPTION_KEY` **no se puede perder ni rotar a la ligera**: si
      cambia, los teléfonos ya guardados dejan de poder descifrarse.
- [ ] Borrar las 8 cuentas de demo (contraseña `Demo1234!`, igual para todas).
- [ ] Publicar el aviso de privacidad real (LGPDPPSO / ley estatal aplicable).

## 4. Integraciones que necesitan credenciales

| Servicio | Variable | Sin ella qué pasa |
|---|---|---|
| Clasificador de IA | `ANTHROPIC_API_KEY` | El bot cae al menú de categorías tradicional (previsto en el SPEC §4.1) |
| WhatsApp Cloud API | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN` | Se usa el simulador de `/dev/whatsapp` |
| Almacenamiento S3 | `S3_*` | Las fotos se guardan en `/public/uploads` del servidor |
