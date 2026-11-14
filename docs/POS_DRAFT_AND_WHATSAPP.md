# Borrador del POS y visor web

Última actualización: 2026-11-14.

## Borrador persistente del POS

El POS mantiene un borrador local del pedido en construcción mediante localStorage con la clave versionada 'alento-pos-active-draft-v1'.

Se conserva:
- modalidad del pedido y estado del selector;
- cliente seleccionado y búsqueda escrita;
- productos y cantidades del carrito;
- configuraciones abiertas de pizza, pizza personalizada y combo;
- línea del carrito que se está editando;
- categoría, búsqueda del catálogo y posición vertical de la página;
- datos del formulario de cliente y dirección en edición;
- estado de apertura del checkout.

El borrador se restaura al volver a '/interno', incluso después de navegar a Pedidos, Cocina u otro módulo que desmonte el POS. Se hidrata antes de activar el guardado para evitar que los valores iniciales sobrescriban el borrador. La posición vertical se recupera después de cargar el catálogo.

Al confirmar la creación del pedido, el POS limpia el borrador y reinicia el formulario para evitar que un pedido ya creado vuelva a aparecer como pedido pendiente de enviar.

La persistencia es local al navegador/perfil donde se usa la PWA. No es un borrador compartido entre diferentes equipos o perfiles. Los datos de pedido siguen sin ser un pedido real hasta que el usuario confirma el checkout; la autoridad de precios y validaciones continúa siendo el servidor.

## Visor web en la PWA

El POS incorpora una tercera columna web mediante un iframe del navegador. Incluye Chatwoot, WhatsApp Web, dirección HTTPS personalizada, recarga, ampliar/reducir y ocultar/mostrar. La última dirección se recuerda en localStorage.

WhatsApp Web bloquea su incrustación en sitios externos, por lo que se ofrece abrirlo en una pestaña nueva. Chatwoot se puede mostrar dentro del iframe si su servidor permite el origen de Alentó en su política CSP/X-Frame-Options. La PWA no puede anular esas restricciones ni compartir la sesión/cookies de otros dominios.

La integración es web/PWA; no requiere ni utiliza Electron o un instalador de Windows. El visor no cambia la lógica de pedidos, checkout ni base de datos.
