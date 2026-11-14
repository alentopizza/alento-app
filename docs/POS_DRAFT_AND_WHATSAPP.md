# Borrador del POS y acceso rápido a WhatsApp

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

La persistencia es local al navegador/perfil de Windows donde se usa la aplicación. No es un borrador compartido entre diferentes equipos o perfiles. Los datos de pedido siguen sin ser un pedido real hasta que el usuario confirma el checkout; la autoridad de precios y validaciones continúa siendo el servidor.

## Acceso rápido a WhatsApp

WhatsAppQuickAccess se muestra como acceso flotante en las superficies internas autenticadas. Permite minimizar u ocultar el acceso, y conserva esa preferencia local al navegar entre módulos.

El botón abre WhatsApp Web (https://web.whatsapp.com/) en una ventana independiente del navegador. El primer ingreso requiere escanear el QR desde el teléfono vinculado. La sesión queda bajo el almacenamiento/cookies que administra WhatsApp en ese navegador.

**Límite de la implementación actual:** Alentó App se ejecuta como Next.js/PWA y el repositorio no contiene una capa Electron ni un contenedor de escritorio nativo. Por eso esta entrega no incrusta WhatsApp dentro del DOM de Alentó ni comparte cookies/sesión con la aplicación; abre WhatsApp Web en una ventana separada. WhatsApp bloquea la incrustación en iframes en sus superficies web. Una integración verdaderamente embebida requeriría desarrollar y distribuir un shell de escritorio Electron (con ventana WebContentsView independiente), además de mantener su instalador de Windows.

No se altera el flujo de pedidos, la integración Chatwoot existente ni los datos de clientes.


## Cambio de enfoque: WhatsApp Web integrado en escritorio

La integración objetivo ya no es una bandeja Chatwoot ni una ventana emergente. Se construye un wrapper Electron para Windows que muestra WhatsApp Web en un panel derecho mediante WebContentsView, con sesión persistente local y controles de ampliar/cerrar/recargar. La PWA web no puede incrustar WhatsApp Web; se necesita instalar el nuevo ejecutable de escritorio. Ver `docs/DESKTOP_WHATSAPP.md`.
