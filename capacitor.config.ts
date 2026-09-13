import type { CapacitorConfig } from '@capacitor/cli'

/**
 * La app para App Store y Google Play.
 *
 * Envuelve el sitio en una app nativa (Capacitor): el formulario, el mapa y
 * la cámara son exactamente los mismos, no hay una segunda base de código.
 * La app carga el sitio desde `server.url`; lo que aporta lo nativo son el
 * ícono en la tienda, las notificaciones push y la pantalla de arranque.
 *
 * `CAP_SERVER_URL` decide qué carga:
 *   · producción:  https://demosvoz.com  (o el dominio del municipio)
 *   · desarrollo:  la URL del túnel de ngrok, o http://localhost:3000 en el
 *                  simulador de iOS (que ve el localhost de la Mac)
 */
const url = process.env.CAP_SERVER_URL ?? 'https://demosvoz.com'

const config: CapacitorConfig = {
  appId: 'com.demoscopia.demosvoz',
  appName: 'DemosVoz',
  webDir: 'capacitor/www',
  server: {
    url,
    // Android no carga http:// salvo que se le permita; solo importa en dev.
    cleartext: url.startsWith('http://'),
  },
  ios: {
    contentInset: 'automatic',
    scheme: 'DemosVoz',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    StatusBar: { style: 'LIGHT', backgroundColor: '#ffffff' },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
}

export default config
