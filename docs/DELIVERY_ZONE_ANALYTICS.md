# Analítica de zonas de entrega

## Objetivo

Separar dos necesidades distintas:

1. **Mapa de entregas**: operación en vivo de pedidos activos y repartidores.
2. **Zonas de entrega**: análisis histórico de dónde se concentran los domicilios.

Ambas vistas se abren desde el header del módulo Pedidos.

## Snapshot de domicilio en Order

Los pedidos a domicilio conservan:

- `deliveryZoneId`
- `deliveryZoneName`
- `deliveryDistanceMeters`
- `deliveryFee`

La distancia es la distancia comercial directa utilizada por `resolveDeliveryPricing` para seleccionar la zona.

Estos valores se actualizan cuando:

- se crea un pedido desde POS;
- se crea un pedido desde checkout web;
- se cambia la dirección del domicilio;
- se cambia el cliente/dirección de un pedido;
- se edita la modalidad o dirección antes del cierre.

La intención es que un cambio futuro en Configuración > Domicilios no reescriba el significado histórico de un pedido ya creado.

## Pedidos antiguos

La API `GET /api/analytics/delivery-zones` prioriza siempre el snapshot guardado en el pedido.

Para datos antiguos:

- si existe `deliveryZoneId` o `deliveryZoneName`, se conserva como zona histórica aunque ya no exista en la configuración actual;
- si no hay snapshot pero existen coordenadas, se reconstruye la zona con la distancia directa y los rangos activos actuales;
- si no existe información suficiente, el pedido queda como **sin clasificar**.

La interfaz informa cuántos pedidos fueron reconstruidos y cuántos quedaron sin clasificar.

## Período

Endpoint:

`GET /api/analytics/delivery-zones?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

Las fechas representan días calendario de Bogotá (`America/Bogota`) y filtran por `Order.createdAt`.

Se incluyen pedidos:

- `fulfillmentType = DELIVERY`;
- distintos de `DRAFT`;
- distintos de `CANCELED`.

## Métricas

Por zona:

- cantidad de pedidos;
- participación sobre pedidos clasificados;
- valor total de pedidos;
- dinero recibido mediante pagos `PAID`;
- valor cobrado por domicilios;
- ticket promedio;
- último pedido;
- cantidad de pedidos reconstruidos.

Resumen:

- pedidos del período;
- pedidos clasificados;
- zona con más pedidos;
- ventas;
- dinero recibido;
- domicilios cobrados;
- ticket promedio;
- pedidos reconstruidos;
- pedidos sin clasificar.

## Mapa analítico

El mapa dibuja:

- pin oficial de Alentó;
- círculos de las zonas activas actuales;
- un pin por pedido con coordenadas;
- color de pin según zona;
- detalle del pedido al tocar un pin.

Las zonas históricas permanecen en el ranking, pero no dibujan un círculo si ya no forman parte de la configuración actual.

## Mapa operativo

El mapa de entregas en vivo mantiene su propósito operativo e incorpora filtros:

- Todos;
- Sin asignar;
- Asignados;
- En reparto.

En **Sin asignar** se ocultan los repartidores para priorizar pedidos disponibles.

El detalle de cada pedido muestra también la zona y la distancia comercial persistidas.
