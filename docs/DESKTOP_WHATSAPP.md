# WhatsApp integrado en la aplicación de escritorio

## Diseño aprobado

La referencia visual es el archivo del proyecto “Punto de venta con WhatsApp integrado”: navegación lateral compacta, catálogo/operación POS en la columna izquierda, creación del pedido en el centro y WhatsApp Web en una columna derecha dentro de la misma ventana.

## Arquitectura

La aplicación web Next.js no puede incrustar WhatsApp Web en un iframe por las políticas de seguridad del sitio. Para reproducir la referencia sin una ventana externa, se incorpora un contenedor Electron para Windows. Electron mantiene la aplicación web de Alentó en la vista principal y añade WhatsApp Web mediante `WebContentsView` en la columna derecha.

La vista WhatsApp usa la partición persistente `persist:alento-whatsapp`. El primer uso requiere escanear el QR; las siguientes aperturas reutilizan el perfil local de Electron. La sesión es local a ese equipo y no se sincroniza con Chrome, PWA ni otros dispositivos.

## Interacción

- WhatsApp se abre por defecto en el escritorio.
- La barra superior identifica WhatsApp Web y ofrece recargar, ampliar/reducir y cerrar.
- Al cerrar, la vista se oculta sin borrar su sesión.
- Un acceso flotante permite volver a mostrarla.
- El POS se reacomoda en dos columnas de trabajo mientras WhatsApp ocupa la derecha.
- El wrapper conserva backend y autenticación actuales; no cambia el servidor ni la base de datos.

## Entrega

El instalador Windows se construye con el workflow `.github/workflows/build-desktop.yml`. Se descarga desde el artefacto de GitHub Actions. El usuario deberá instalar esta nueva aplicación de escritorio; la PWA/atajo anterior no adquiere la capacidad Electron mediante un despliegue web.

## Seguridad y limitaciones

La vista principal usa preload limitado, aislamiento de contexto, Node Integration desactivado y sandbox. El sitio de Alentó no recibe acceso a cookies o credenciales de WhatsApp. El contenedor no automatiza mensajes ni elude el inicio de sesión: utiliza WhatsApp Web y su QR normal.

La integración depende de que WhatsApp Web permita la sesión en Chromium de Electron. La sesión se guarda localmente en el perfil de la aplicación y debe mantenerse protegida por el usuario del sistema operativo.
