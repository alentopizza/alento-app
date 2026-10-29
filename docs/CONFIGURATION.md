# Configuración operativa

Estado: **IMPLEMENTADO**

Última actualización: **2026-10-24**

Ruta: `/configuracion`

Acceso: **ADMIN**

Este documento describe la configuración operativa central de Alentó App. La persistencia vive principalmente en `AppSetting` bajo la configuración POS y es consumida por POS, checkout público, Pedidos, Cocina, reparto, Caja y clientes.

## Secciones vigentes

### Sede

Configura:

- dirección oficial;
- `placeId`;
- coordenadas;
- dirección formateada;
- pin de origen;
- horario de servicio por día.

El horario tiene:

- día;
- activo/inactivo;
- apertura;
- cierre.

Los pedidos programados deben caer dentro de estas ventanas. La validación existe también en backend; la UI no es autoridad.

### Domicilios

Configura bandas de cobertura:

- nombre;
- distancia mínima;
- distancia máxima;
- tarifa;
- activo/inactivo.

Incluye mapa visual de radios alrededor de la sede.

La tarifa comercial real se selecciona en servidor a partir de la ruta/distancia vigente. No volver a permitir que POS o Pedidos elijan manualmente una tarifa arbitraria.

Documentos relacionados:

- `docs/PUBLIC_CHECKOUT_MAPS.md`;
- `docs/DELIVERY_ZONE_ANALYTICS.md`;
- `docs/MAPS_VISUAL_SYSTEM.md`.

### Repartidores

Configura:

- `maxConcurrentDeliveries`;
- radio/geocerca de aceptación para autoasignación;
- `earningPercent`;
- `freeDeliveryEarning`.

Estas reglas son consumidas por el backend de reparto. No deben duplicarse como constantes de UI.

Documento: `docs/DRIVERS.md`.

### Clientes

Configura:

- habilitación de eliminación masiva de clientes sin pedidos.

La acción efectiva continúa protegida por backend y por las reglas de integridad del módulo Clientes.

Documento: `docs/CUSTOMERS.md`.

### Medios de pago

Permite:

- activar/desactivar medios configurados;
- revisar uso por rango de fechas;
- ver número de transacciones;
- monto;
- participación;
- pagos no clasificados.

Las estadísticas se basan en movimientos reales registrados, no convierten un `Payment PENDING` en ingreso.

Documento: `docs/PAYMENTS_AND_CASH.md`.

### Personalización pública

Desde Configuración se enlaza a `/personalizacion`.

Allí se administran:

- imagen Home móvil;
- imagen Home escritorio;
- hero del menú público.

La personalización no debe crear una segunda configuración comercial.

## APIs principales

- `GET /api/settings`;
- escritura de `/api/settings` solo ADMIN;
- `GET /api/settings/payment-stats`;
- `POST /api/settings/store-reverse-geocode` cuando aplica;
- `GET /api/delivery/origin` para consumidores autorizados/públicos según middleware.

## Consumidores críticos

Cambios en Configuración pueden afectar:

- creación y edición de pedidos;
- pedidos programados;
- cobertura y tarifa de domicilio;
- checkout WEB;
- mapas;
- autoasignación de repartidores;
- cartera de repartidores;
- eliminación masiva de clientes;
- medios de pago visibles.

Por ello, todo cambio de estructura de `pos_settings` debe conservar defaults y compatibilidad con JSON histórico.

## Archivos principales

- `src/app/configuracion/page.tsx`;
- `src/app/api/settings/route.ts`;
- `src/app/api/settings/payment-stats/route.ts`;
- `src/components/StoreOriginMapPicker.tsx`;
- `src/components/DeliveryCoverageMap.tsx`;
- `src/lib/orderScheduling.ts`;
- `prisma/schema.prisma`.

## Reglas de no regresión

- no confiar únicamente en restricciones de formulario;
- no duplicar horarios o tarifas en otros módulos;
- no guardar secretos de integraciones dentro de configuración pública;
- no eliminar campos existentes de `AppSetting` sin migración/normalización compatible;
- no cambiar reglas de ganancia retroactivamente sobre pedidos ya acreditados;
- no permitir que una modificación visual de mapa cambie por sí sola la tarifa persistida.
