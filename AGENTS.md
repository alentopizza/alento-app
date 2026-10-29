# AGENTS.md — Reglas obligatorias de desarrollo de Alentó App

Alentó App está en producción. Estas reglas aplican a cualquier implementación, corrección o refactorización dentro del repositorio.

## 1. Reutilizar antes de crear

Antes de crear un componente, helper, endpoint, parser, validador, flujo de estado o regla de negocio nueva:

1. buscar primero en el repositorio si ya existe una implementación equivalente o parcialmente reutilizable;
2. identificar cuál es la fuente de verdad actual;
3. extender o reutilizar esa fuente cuando sea técnicamente compatible;
4. evitar crear un segundo flujo que resuelva la misma acción desde otra pantalla;
5. si realmente se necesita una implementación distinta, documentar por qué no puede reutilizarse la existente.

La regla es:

> Misma acción o regla de negocio = misma fuente de verdad.  
> Distinta pantalla = puede cambiar la presentación, permisos o contexto, pero no debe duplicar la regla.

No copiar lógica de una pantalla a otra para "adaptarla". Extraerla o consumir la implementación compartida.

## 2. Producción: preservar comportamiento existente

El sistema está en operación real. Cada ajuste debe priorizar continuidad y compatibilidad.

- No hacer refactorizaciones masivas si una corrección incremental resuelve el problema.
- No cambiar contratos de API, semántica de datos o estados sin revisar todos sus consumidores.
- No eliminar código legacy hasta confirmar que ninguna ruta activa lo usa.
- Mantener compatibilidad con datos históricos guardados antes del cambio.
- Cuando evolucione una estructura persistida, los lectores deben soportar tanto la forma anterior como la nueva mientras existan registros históricos.
- La validación server-side sigue siendo la autoridad para precios, cobertura, pedidos, pagos y configuración estructurada.
- No confiar únicamente en una validación o cálculo de UI.
- Antes de modificar un flujo crítico, revisar las rutas activas que lo consumen y su efecto en POS, Pedidos, Cocina, Caja, Repartidor y experiencia pública según corresponda.
- Preferir cambios pequeños, verificables y reversibles.

## 3. Fuentes compartidas vigentes

Antes de implementar algo relacionado con estos temas, revisar primero estas fuentes:
- Caja: el movimiento vivo de la sesión (ventas cobradas, otros ingresos, salidas, préstamos y abonos) debe reutilizar `/api/caja/summary`. `CashRegisterControl` administra apertura/cierre y snapshots; no debe mantener una segunda copia independiente del movimiento vivo.

- Cobertura y tarifa de domicilio: `src/lib/deliveryPricing.ts`.
- Distancias/rutas auxiliares: librerías de delivery existentes en `src/lib`.
- Editor de ubicación de cliente interno: `src/components/CustomerAddressEditor.tsx`.
- Editor de datos personales de cliente interno: `src/components/CustomerPersonalEditor.tsx`.
- Construcción, validación y precio de pizzas: `src/lib/pizzaConfiguration.ts`.
- Construcción, validación y precio de combos: `src/lib/comboConfiguration.ts`.
- Presentación de configuraciones de pedidos: `src/lib/orderPresentation.ts`.
- Normalización/validación server-side de líneas: usar el normalizador de órdenes existente antes de crear validación paralela.
- Flujo y etiquetas de estados: `src/lib/orderWorkflow.ts`.
- Selector operativo de estados: `src/components/OrderStatusSelector.tsx`.
- Tokens de seguimiento: `src/lib/orderTracking.ts`.
- Web Push del personal: `src/lib/driverPush.ts` como motor server-side compartido y `src/lib/webPushClient.ts` como cliente compartido.
- Alertas de nuevos pedidos en Cocina: `src/lib/kitchenPush.ts` + `src/components/KitchenOrderAlerts.tsx`.
- Campañas manuales PWA: `src/lib/pushCampaigns.ts` + `src/components/PushCampaignManager.tsx` + `/api/push-campaigns`.
- Repartidor oficial: PWA en `/repartidor`; ubicación vía `navigator.geolocation.watchPosition()` y `/api/repartidor/location`. No crear un camino Android/nativo paralelo.
- Arquitectura canónica de notificaciones Push: `docs/PUSH_NOTIFICATIONS.md`.
- Observabilidad de producción: `src/lib/observability.ts` + `src/instrumentation.ts` + `/api/health` + `/salud-sistema`. Documento canónico: `docs/OBSERVABILITY.md`.
- Errores frontend: `src/lib/clientObservability.ts` + `src/components/ClientObservabilityReporter.tsx`. No crear reportadores paralelos.
- Nuevas integraciones críticas deben reportar fallos mediante `reportOperationalIncident()` y logs estructurados; no volver a `console.warn/error` aislados cuando el evento requiera seguimiento operativo.


Esta lista no reemplaza la búsqueda en el repositorio: es un punto de partida.

## 4. Configuración estructurada y compatibilidad histórica

`OrderItem.configuration` es información persistida y crítica.

Para pizzas y combos:

- no reconstruir la configuración desde texto visible;
- no asumir que todos los pedidos históricos tienen exactamente la estructura más nueva;
- para combos, los lectores deben soportar la forma histórica `pizza.flavor` y la forma actual `pizza.flavors`;
- la presentación debe pasar por `src/lib/orderPresentation.ts` siempre que sea posible;
- si una vista necesita una presentación especial, debe usar los datos normalizados del presentador compartido y no volver a interpretar el JSON por su cuenta.

## 5. UI pública e interna

Antes de crear o modificar tipografía, tamaños de texto, estados o jerarquía visual, revisar `docs/UI_VISUAL_SYSTEM.md` y reutilizar la escala `.alento-ui-*` definida en `src/app/globals.css`. No introducir microtexto funcional menor a 10 px ni tamaños arbitrarios cuando exista un rol tipográfico equivalente.

Reutilizar la lógica no significa forzar la misma interfaz.

La app pública, POS, Pedidos, Cocina y Repartidor pueden tener experiencias distintas, pero deben compartir reglas de negocio, configuración, precios y normalización cuando representan la misma acción.

## 6. Idioma visible y localización

El idioma de producto de Alentó App es **español de Colombia (`es-CO`)**.

Reglas obligatorias:

- todo texto visible para clientes, colaboradores y administradores debe estar en español claro de Colombia;
- botones, filtros, estados, validaciones, mensajes de error y ayudas no deben exponer códigos técnicos en inglés cuando exista una equivalencia operativa;
- fechas visibles deben usar formato/localización `es-CO` y zona horaria `America/Bogota` cuando corresponda;
- moneda visible debe presentarse como pesos colombianos (COP);
- enums, nombres de columnas, rutas, acciones de auditoría y contratos internos pueden permanecer en inglés para preservar compatibilidad;
- **no traducir valores persistidos solo por presentación**: crear/usar una capa de etiquetas en español;
- los códigos históricos también deben presentarse mediante esa capa cuando se muestren en UI;
- logs de infraestructura de npm, Prisma, Next.js, PostgreSQL o proveedores externos pueden permanecer en inglés porque no son copy del producto.

Auditoría usa como fuente de presentación compartida:

`src/lib/auditPresentation.ts`

Si se añade una acción, entidad, estado u origen nuevo a AuditLog, se debe añadir su etiqueta visible en español Colombia.

## 7. Checklist antes de cerrar un cambio

Antes de considerar terminado un ajuste:

- confirmar que no se creó un flujo paralelo a uno existente;
- revisar compatibilidad con registros históricos;
- revisar las pantallas activas que muestran o consumen el dato modificado;
- verificar imports y referencias de las rutas activas;
- comprobar que la corrección no cambie comportamiento no relacionado;
- documentar cualquier nueva fuente de verdad compartida;
- actualizar el documento canónico del módulo cuando cambie comportamiento, reglas, endpoints o persistencia;
- actualizar `docs/FEATURE_INVENTORY.md` cuando cambie una ruta, acceso, módulo o capacidad transversal;
- actualizar `docs/CURRENT_STATE.md` cuando cambie el estado general del producto;
- actualizar `docs/DEPLOYMENT.md` cuando cambien variables, scripts de arranque, infraestructura o estrategia de Prisma.

**Un cambio funcional no se considera terminado si el código y la documentación quedan desalineados.**

Si existe duda entre crear algo nuevo o extender un flujo actual, la opción por defecto es extender/reutilizar el flujo actual.
