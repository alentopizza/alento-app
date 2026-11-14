# Alentó Pizza — aplicación de escritorio Windows

Este contenedor Electron abre la aplicación web alojada de Alentó y reserva una columna derecha para WhatsApp Web dentro de la misma ventana.

## Desarrollo local

1. Instalar Node.js 22.
2. Desde esta carpeta ejecutar `npm install`.
3. Ejecutar `npm start`.

Por defecto, la app carga `https://alentopizza.com`. Para probar otro entorno:

- PowerShell: `$env:ALENTO_APP_URL="https://tu-entorno"; npm start`
- CMD: `set ALENTO_APP_URL=https://tu-entorno && npm start`

## Crear instalador Windows

Desde esta carpeta:

```bash
npm install
npm run dist:win
```

El instalador se genera en `desktop/dist`.

También se puede ejecutar el workflow **Build Alento Desktop for Windows** desde GitHub Actions y descargar el artefacto `alento-pizza-windows-installer`.

## WhatsApp Web

- Se muestra con `WebContentsView` dentro de la misma ventana de Alentó.
- La sesión se guarda en la partición persistente `persist:alento-whatsapp` del perfil local de Electron.
- No se comparte con Chrome ni con la PWA anterior. La primera vez se debe escanear el QR.
- El token, las cookies y la sesión de WhatsApp no pasan por el servidor de Alentó.
- Cerrar el panel lo oculta; no borra la sesión.
- La opción de recargar no elimina la sesión.

## Seguridad y alcance

La vista principal conserva `contextIsolation`, `nodeIntegration: false` y `sandbox: true`. El preload solo expone tres acciones limitadas para posicionar, mostrar u ocultar y recargar el panel de WhatsApp. Los enlaces externos HTTPS se abren en el navegador predeterminado.

Esta aplicación de escritorio es un contenedor del sitio alojado; el backend, la base de datos y la autenticación de Alentó siguen funcionando en el servidor. La PWA del navegador no puede mostrar WhatsApp Web integrado y continúa funcionando como sitio web.
