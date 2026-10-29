# Métricas e integraciones de medición

Última actualización: 2026-10-09.

Este documento es la referencia canónica del módulo `/metricas`.

El módulo separa dos responsabilidades:

1. **Métricas internas**: analítica propia de Alentó, independiente de plataformas externas.
2. **Integraciones externas**: conexión guiada de Meta Pixel, Google Analytics 4, TikTok Pixel, Microsoft Clarity, Google Tag Manager y Google Ads.

La analítica interna debe seguir funcionando aunque las integraciones externas estén desactivadas o el cliente no otorgue consentimiento publicitario.

---

## Rutas y archivos principales

Ruta administrativa:

- `/metricas`

UI:

- `src/app/metricas/page.tsx`

Analítica pública propia:

- `src/lib/publicAnalytics.ts`
- `POST /api/metrics/events`

Dashboard:

- `GET /api/metrics/dashboard?days=1|7|30|90`

Configuración externa:

- `src/lib/trackingSettings.ts`
- `GET /api/metrics/settings`
- `PUT /api/metrics/settings`
- `GET /api/metrics/public-config`
- `POST /api/metrics/verify`

Carga de plataformas externas:

- `src/components/PublicTracking.tsx`

Persistencia:

- eventos internos en `CatalogAnalyticsEvent`;
- configuración externa en `AppSetting`, clave `marketing_tracking_settings`.

---

# Métricas internas

## Indicadores

Actualmente muestra:

- visitas al menú;
- personas únicas;
- carritos iniciados;
- pedidos;
- productos vistos;
- acciones de agregar al carrito;
- carritos abandonados;
- venta atribuida.

El abandono se calcula sobre carritos que:

- tuvieron al menos un `ADD_TO_CART`;
- no terminaron en pedido;
- no fueron vaciados explícitamente;
- llevan al menos 30 minutos sin actividad.

## Períodos

El administrador puede consultar:

- Hoy;
- 7 días;
- 30 días;
- 90 días.

La zona horaria de lectura es `America/Bogota`.

## Actividad por día y hora

La visual principal es un **mapa de calor día × hora**.

Cada celda representa cargas de menú en una hora concreta.

- filas: días;
- columnas: 00 a 23;
- mayor intensidad = mayor actividad;
- el tooltip incluye visitas, productos vistos, agregados al carrito y pedidos.

El backend expone esta estructura como `hourlyByDay`.

## Embudo del catálogo

El embudo sigue:

```text
Visitantes → Carrito → Checkout → Pedido
```

Cada etapa muestra:

- cantidad;
- porcentaje sobre visitantes;
- porcentaje frente a la etapa anterior cuando aplica.

La tarjeta también resume:

- cuántos visitantes llegan a checkout;
- conversión final a pedido.

## Productos con más interés

La tabla cruza por producto:

- vistas;
- agregados al carrito;
- tasa de agregado.

No sustituye reportes financieros; representa comportamiento dentro del catálogo.

## Origen del tráfico

El dashboard normaliza fuentes técnicas para mostrarlas con etiquetas legibles.

```text
direct                         → Acceso directo
seguimiento                    → Seguimiento de pedido
alentopizza.com                → Navegación interna
eventsmanager.facebook.com     → Facebook / Meta
ads.tiktok.com                 → TikTok
instagram.com                  → Instagram
google.*                       → Google
whatsapp.com / wa.me           → WhatsApp
```

**Acceso directo** significa que no llegó una campaña o sitio de referencia detectable. Puede ser:

- URL escrita o pegada;
- favorito;
- acceso desde una app que no comparte referrer;
- otro origen sin atribución detectable.

Cada origen muestra:

- entradas;
- porcentaje sobre las entradas detectadas;
- personas únicas.

Los parámetros UTM tienen prioridad sobre el referrer.

El banner de seguimiento usa:

```text
utm_source=seguimiento
utm_medium=app
utm_campaign=promociones_activas
```

---

# Eventos internos

Eventos soportados:

```text
MENU_VIEW
PRODUCT_VIEW
ADD_TO_CART
CART_VIEW
CHECKOUT_STARTED
CART_EMPTIED
ORDER_CREATED
```

Cuando corresponde, el evento conserva:

- `productId`;
- `productName`;
- `value`;
- `quantity`;
- `itemCount`;
- `orderId`;
- líneas reales del carrito;
- fuente, medio y campaña;
- visitor/session/cart IDs anónimos.

---

# Integraciones externas

La pestaña **Integraciones externas** incluye:

- tarjeta de Ajustes de métricas;
- estado de cada conexión;
- modal con instrucciones;
- validación de formato;
- comprobación técnica cuando el proveedor expone un recurso verificable.

## Regla crítica: una sola conexión por plataforma

No instalar la misma plataforma por dos vías.

Ejemplo incorrecto:

```text
GA4 directo en Alentó
+
GA4 instalado dentro de Google Tag Manager
```

Eso puede duplicar `PageView`, `AddToCart`, `Purchase` y otras señales.

Elegir **GTM o conexión directa** para cada plataforma.

En la instalación actual de Alentó se recomienda mantener las conexiones directas ya configuradas y dejar GTM pendiente mientras no sea necesario.

---

# Ajustes de métricas

## Rastreadores externos

Controla si Alentó carga scripts externos.

Si está apagado:

- la analítica interna continúa;
- Meta, Google, TikTok y Clarity no se cargan.

## Solicitar consentimiento

Si está activo, las plataformas externas solo se cargan después de que el usuario acepte.

El consentimiento vive en navegador bajo:

`alento_tracking_consent_v1`

Valores:

- `granted`;
- `denied`.

El aviso público ofrece:

- **Aceptar**;
- **Gracias 😔**.

El consentimiento externo no debe bloquear catálogo, carrito, checkout ni seguimiento.

---

# Guías de conexión

## Meta Pixel

Campo:

- **Pixel ID** numérico.

Formato:

```text
123456789012345
```

No pegar el script completo.

### Pasos

1. Abrir Meta Events Manager.
2. Crear o seleccionar una fuente Web.
3. Elegir instalación manual.
4. Copiar únicamente el Pixel ID.
5. Pegar el ID en Alentó.
6. Guardar y probar.
7. En Meta abrir **Probar eventos**.
8. Abrir `https://alentopizza.com/menu`.
9. Probar producto, carrito, checkout y compra.

### Eventos enviados

```text
MENU_VIEW          → PageView
PRODUCT_VIEW       → ViewContent
ADD_TO_CART        → AddToCart
CHECKOUT_STARTED   → InitiateCheckout
ORDER_CREATED      → Purchase
```

Checkout y Purchase incluyen IDs de productos, número de artículos, moneda y valor cuando están disponibles.

### Estado actual de Alentó

- conexión directa configurada;
- PageView validado;
- ViewContent validado;
- AddToCart validado;
- InitiateCheckout validado;
- Purchase pendiente de validación con una compra completa.

---

## Google Analytics 4

Campo:

- **Measurement ID**.

Formato:

```text
G-XXXXXXXXXX
```

### Pasos

1. Abrir Google Analytics.
2. Entrar a la propiedad de Alentó.
3. Ir a **Administrar → Flujos de datos → Web**.
4. Crear o abrir el flujo de `alentopizza.com`.
5. Confirmar que la URL del flujo sea la actual.
6. Copiar el Measurement ID.
7. Pegar el ID en Alentó.
8. Guardar y probar.
9. Abrir **Tiempo real** o **DebugView**.
10. Generar navegación en el menú.

### Eventos enviados

```text
MENU_VIEW          → page_view
PRODUCT_VIEW       → view_item
ADD_TO_CART        → add_to_cart
CART_VIEW          → view_cart
CHECKOUT_STARTED   → begin_checkout
ORDER_CREATED      → purchase
```

Carrito, checkout y compra incluyen `items`.

### Estado actual de Alentó

- conexión directa configurada;
- Realtime validado;
- `page_view`, `view_item`, `add_to_cart`, `view_cart` y `begin_checkout` observados;
- `purchase` pendiente de validación con una compra completa.

---

## TikTok Pixel

Campo:

- **Pixel ID**.

Ejemplo de formato:

```text
DB4M0Q3C77U074LG1L90
```

No guardar el script completo.

### Pasos

1. Abrir TikTok Ads Manager.
2. Ir a **Herramientas → Administrador de eventos**.
3. Conectar fuente Web.
4. Elegir **Configuración manual**.
5. Elegir **Píxel de TikTok**.
6. Copiar el Pixel ID del código base.
7. Pegar únicamente el ID en Alentó.
8. Guardar y probar.
9. Para eventos elegir **código personalizado**.
10. No pegar nuevamente los snippets de eventos de TikTok; Alentó ya los envía.
11. Abrir **Eventos de prueba** y probar `/menu`.

### Eventos enviados

```text
PRODUCT_VIEW       → ViewContent
ADD_TO_CART        → AddToCart
CHECKOUT_STARTED   → InitiateCheckout
ORDER_CREATED      → CompletePayment
```

Checkout y pago incluyen:

- `content_id`;
- `content_name`;
- `quantity`;
- `price`;
- `currency`;
- `value`.

### Estado actual de Alentó

- conexión directa configurada;
- ViewContent validado;
- AddToCart validado;
- InitiateCheckout validado sin advertencia de `content_id`;
- CompletePayment pendiente de validación con una compra completa.

---

## Microsoft Clarity

Campo:

- **Project ID**.

Formato:

```text
abcdefghij
```

### Pasos

1. Crear proyecto para `alentopizza.com`.
2. Abrir **Configuración → Setup**.
3. Elegir instalación manual.
4. Copiar el ID usado en `clarity.ms/tag/PROJECT_ID`.
5. Pegar solo el Project ID en Alentó.
6. Guardar y probar.

Clarity puede tardar en mostrar las primeras sesiones.

Además recibe eventos personalizados `alento_*`, por ejemplo:

- `alento_menu_view`;
- `alento_product_view`;
- `alento_add_to_cart`;
- `alento_checkout_started`;
- `alento_order_created`.

### Estado actual de Alentó

- conexión configurada;
- script accesible;
- sesiones/mapas dependen de tráfico y consentimiento.

---

## Google Tag Manager

Campo:

- **Container ID**.

Formato:

```text
GTM-XXXXXXX
```

### Pasos

1. Crear cuenta/contenedor Web.
2. Usar `alentopizza.com`.
3. Copiar el ID `GTM-`.
4. Pegar el ID en Alentó.
5. Publicar el contenedor.

### Regla

GTM es una **alternativa** de instalación, no un requisito.

Si GA4, Meta o TikTok se instalan dentro de GTM, desconectar la conexión directa correspondiente para evitar duplicados.

### Estado actual

Pendiente. No es necesario para las conexiones directas actuales.

---

## Google Ads

Campos:

- Google tag ID: `AW-123456789`;
- etiqueta de conversión de compra.

La etiqueta es la parte posterior a la barra en:

```text
AW-123456789/ETIQUETA
```

### Pasos

1. Abrir Google Ads.
2. Ir a **Objetivos → Conversiones**.
3. Crear o abrir una conversión de compra web.
4. Copiar el Google tag ID `AW-`.
5. Copiar la etiqueta de conversión.
6. Guardar ambos valores en Alentó.
7. Validar con una compra.

`ORDER_CREATED` envía conversión solo si existen tanto el ID como la etiqueta.

### Estado actual

Pendiente por decisión de negocio. No configurar hasta que Alentó vaya a pautar con Google Ads.

---

# Qué comprueba “Guardar y probar”

La verificación interna no significa que la plataforma ya registró una conversión real.

Alentó comprueba:

1. que el identificador tenga formato válido;
2. que quede guardado;
3. cuando existe un recurso público verificable, que el script del proveedor responda.

La confirmación definitiva se hace en cada plataforma después de generar tráfico:

- Meta: Events Manager → Probar eventos;
- GA4: Tiempo real / DebugView;
- TikTok: Events Manager → Test Events;
- Clarity: sesiones / grabaciones.

---

# Reglas de no regresión

1. La analítica interna debe funcionar sin rastreadores externos.
2. No duplicar una plataforma entre GTM y conexión directa.
3. No almacenar scripts completos cuando basta un ID público.
4. No exponer secretos ni tokens privados en configuración pública.
5. Mantener moneda `COP` en eventos de ecommerce.
6. Checkout y compra deben conservar las líneas reales del carrito.
7. UTM prevalece sobre referrer.
8. Normalizar dominios técnicos conocidos a etiquetas legibles.
9. El consentimiento externo no bloquea compra ni seguimiento.
10. No considerar una integración recibiendo eventos solo porque el script sea accesible; verificar en el panel del proveedor.

---

# Prueba mínima después de redeploy

## Métricas internas

1. abrir `/menu`;
2. abrir un producto;
3. agregar al carrito;
4. entrar al carrito;
5. continuar al checkout;
6. revisar `/metricas`;
7. confirmar mapa de calor, embudo, producto y origen.

## Integraciones externas

Con consentimiento aceptado:

1. abrir `/menu`;
2. abrir un producto;
3. agregar al carrito;
4. continuar pedido;
5. verificar eventos en la plataforma configurada.

No requiere `prisma db push` si el cambio es únicamente de UI o configuración de este módulo.
