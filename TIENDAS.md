# La app en App Store y Google Play

Todo lo que hace falta para subirla está aquí. Lo que está hecho, está hecho;
lo que falta, solo lo puede conseguir el municipio o DemosVoz, y está marcado.

## Qué es la app

El mismo sitio, envuelto en una app nativa con **Capacitor**. No hay una
segunda base de código: el formulario, el mapa, la cámara y el bot son los
mismos. Lo que la app aporta sobre el sitio:

- Estar en las tiendas, con ícono, para que alguien la busque y la encuentre.
- **Notificaciones push**: el teléfono sigue los folios que la persona levanta
  o consulta, y le avisa cuando se asigna, se resuelve o se reabre. Sin
  preguntarle quién es: el teléfono se liga a folios, no a una identidad.
- Pantalla de arranque con el logotipo, ícono adaptativo en Android.

Los proyectos nativos ya están generados en `ios/` y `android/`, con íconos,
pantallas de arranque y los textos de permisos que Apple y Google exigen
(cámara, fotos, ubicación, notificaciones).

## Lo que está hecho ✅

| | |
|---|---|
| Proyecto iOS (`ios/App`) | Generado, con `Info.plist` y permisos |
| Proyecto Android (`android/`) | Generado, con manifest y permisos |
| Íconos y splash | Generados del logotipo para ambas plataformas (`npm run app:iconos` los regenera) |
| Registro de notificaciones | La app manda su token a `/api/app/dispositivo` y lo liga a cada folio que consulta |
| Envío de push | `src/infrastructure/push.ts`, por Firebase Cloud Messaging v1, para iOS y Android |
| Identificador | `com.demoscopia.demosvoz` — cámbialo en `capacitor.config.ts` antes de la primera subida si va a nombre del municipio |
| Política de privacidad | `/privacidad`, que las dos tiendas exigen como URL pública |

## Lo que falta, y quién puede conseguirlo ❌

### Para compilar (una vez, en una Mac)

| Qué | Dónde | Costo |
|---|---|---|
| **Xcode** (versión completa, no solo Command Line Tools) | App Store de macOS | Gratis, ~7 GB |
| **CocoaPods** | `sudo gem install cocoapods` | Gratis |
| **Android Studio** (trae el SDK) | developer.android.com/studio | Gratis |

Esta Mac hoy solo tiene Command Line Tools. Sin Xcode no se compila iOS;
sin Android Studio no se compila Android.

### Para publicar

| Qué | Dónde | Costo |
|---|---|---|
| **Cuenta Apple Developer** | developer.apple.com | 99 USD/año |
| **Cuenta Google Play Console** | play.google.com/console | 25 USD, una vez |
| **Proyecto Firebase** (para push) | console.firebase.google.com | Gratis |

Las cuentas van a nombre de quien publica: DemosVoz para la app genérica, o
el ayuntamiento para una app con su nombre y escudo. Apple pide que una app
de gobierno la publique la entidad de gobierno (guideline 5.2.1), así que
para «Tula de Allende» la cuenta debe ser del ayuntamiento.

## Cómo compilar

```bash
# Apunta la app al sitio que debe cargar
CAP_SERVER_URL="https://demosvoz.com" npm run app:sync

npm run app:ios       # abre Xcode: Product → Archive → Distribute
npm run app:android   # abre Android Studio: Build → Generate Signed Bundle
```

Para probar en el simulador de iOS sin servidor público:
`CAP_SERVER_URL="http://localhost:3000" npm run app:sync`. El simulador ve el
localhost de la Mac. Para un teléfono físico hace falta la URL pública (ngrok).

## Notificaciones push: activarlas

1. En Firebase, crea un proyecto y agrega las dos apps (iOS con el bundle
   `com.demoscopia.demosvoz`, Android con el mismo paquete).
2. Descarga `GoogleService-Info.plist` a `ios/App/App/` y `google-services.json`
   a `android/app/`.
3. En iOS, además: sube la llave APNs (.p8) a Firebase → Cloud Messaging.
4. Configuración del proyecto → Cuentas de servicio → genera una llave JSON.
   Ponla en `.env` en una sola línea como `FCM_SERVICE_ACCOUNT_JSON`.

Sin el paso 4 la app funciona igual; solo no llegan push. Los avisos siguen
saliendo por WhatsApp o Telegram.

## La revisión de Apple: lo que hay que saber

Apple rechaza apps que «solo envuelven un sitio web» (guideline 4.2). Esta
aporta notificaciones push, cámara y ubicación nativas, y una pantalla de
arranque: es suficiente, pero **hay que decirlo en las notas para el revisor**:

> Esta es la app oficial de atención ciudadana de [municipio]. Permite a los
> vecinos reportar fallas en servicios públicos con foto y ubicación, seguir su
> reporte con un folio y recibir notificaciones push cuando se atiende. La
> cuenta de prueba no es necesaria: la app no requiere registro.

Para la ficha de cada tienda hacen falta:
- Nombre, subtítulo y descripción (hay texto en `/plataforma` que sirve de base).
- Capturas de pantalla de un iPhone de 6.7" y un Android (5 mínimo).
- URL de la política de privacidad: `https://demosvoz.com/privacidad`.
- Categoría: Utilidades / Gobierno.
- Cuestionario de privacidad: la app recoge ubicación (mientras se usa, no
  vinculada a identidad), fotos (que el usuario elige) y un token de
  notificaciones. No recoge nombre, correo ni contactos.

Tiempo típico: Apple entre 1 y 7 días; Google, horas a un par de días.
