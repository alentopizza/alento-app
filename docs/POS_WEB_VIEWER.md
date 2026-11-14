# Visor web integrado en el Punto de venta

## Objetivo visual

En la PWA, el POS se organiza en tres columnas: catálogo a la izquierda, creación del pedido en el centro y visor web a la derecha. El visor forma parte del layout; no es un modal superpuesto.

## Uso

El visor se muestra únicamente en la ruta `/interno`:
- Selector rápido de Chatwoot y WhatsApp Web.
- Campo de dirección para cualquier URL HTTPS.
- Navegación, recarga, ampliar/reducir y ocultar.
- Acceso flotante para volver a mostrarlo.
- Recuerda la última URL y etiqueta en localStorage del mismo navegador/perfil.

## Compatibilidad web

El visor utiliza un `iframe` normal del navegador. Puede mostrar sitios que permitan ser incrustados por dominios externos. El servidor del sitio de destino controla esto mediante `Content-Security-Policy: frame-ancestors` o `X-Frame-Options`.

**WhatsApp Web no permite incrustar su aplicación en una página externa.** Al seleccionar WhatsApp Web se muestra una explicación y un botón para abrirlo en una pestaña nueva. La pestaña nueva conserva el POS abierto, por lo que el borrador local del pedido no se pierde.

Chatwoot puede incrustarse solo si la configuración de su servidor permite el origen de Alentó. El visor usa por defecto `https://chat.operadoranordecolombia.com`; si la instalación tiene una ruta de inbox específica, se puede introducir en la barra de direcciones. Si Chatwoot bloquea el iframe, debe habilitarse el origen de Alentó en su política de framing o abrirse externamente.

Solo se aceptan direcciones HTTPS. La PWA no puede saltarse las políticas de framing del sitio de destino ni acceder a sus cookies, almacenamiento o contenido cross-origin.

## Protección del POS

El cambio se limita al shell visual de la ruta `/interno` y al nuevo componente `PosWebViewer`. No modifica `StructuredPosPageV2`, persistencia del borrador, cálculos, checkout, endpoints, reglas de pedidos ni base de datos. En las demás rutas el visor no se monta y el layout habitual se conserva.

## Validación

Después de pasar CI, probar en Chrome/PWA:
- abrir/cerrar/ampliar el visor;
- Chatwoot según la política de framing del dominio;
- WhatsApp abre una pestaña externa con el POS conservado;
- URL HTTPS personalizada;
- cambio de módulo y regreso al POS con carrito en curso.
