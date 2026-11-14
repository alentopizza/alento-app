# Visor web integrado en el Punto de venta

## Objetivo visual

La sección POS de escritorio se distribuye en tres áreas: catálogo a la izquierda, panel de creación del pedido en el centro y visor web a la derecha. El visor forma parte del layout, no es un modal superpuesto.

## Uso

El visor aparece únicamente al abrir `/interno` dentro del contenedor Electron de Windows. Incluye:
- Selector rápido de WhatsApp Web y Chatwoot.
- Campo de dirección para cualquier página HTTPS.
- Acciones para navegar, recargar, ampliar/reducir y ocultar.
- Botón flotante para volver a mostrarlo cuando se oculta.

La última URL y etiqueta se guardan en localStorage del perfil de Alentó. La vista nativa conserva las cookies en la partición persistente `persist:alento-whatsapp`, por lo que WhatsApp puede conservar su sesión tras ocultar el panel o cambiar de sección.

## Arquitectura y seguridad

El wrapper Electron renderiza las páginas externas mediante `WebContentsView`, no iframe. El preload solo expone acciones acotadas para actualizar límites, mostrar/ocultar, navegar y recargar. La navegación se restringe a HTTPS; ventanas emergentes HTTPS se abren en el navegador externo y esquemas como `file:`, `javascript:` o `data:` se bloquean.

La PWA/web normal no muestra el visor ni modifica su layout. El panel se monta solo si `window.alentoDesktop.isDesktop` es verdadero y la ruta es exactamente `/interno`.

## Protección del POS

No se modifica `StructuredPosPageV2`, sus estados, persistencia de borrador, cálculo de precios, checkout, endpoints, reglas de pedidos ni base de datos. El cambio se limita al shell de escritorio y al wrapper Electron. Al navegar fuera de POS el visor se oculta; al volver, el pedido mantiene su flujo habitual.

## Validación pendiente

La rama debe pasar lint, typecheck, pruebas y build. Luego validar en Windows: primer QR, sesión persistente, Chatwoot, URL HTTPS personalizada, resize, ocultar/mostrar, cambio de ruta y pedidos con carrito en curso.
