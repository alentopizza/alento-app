# Sistema visual de mapas

Este documento define la regla visual obligatoria para todos los mapas actuales y futuros de Alentó App.

## Fuente única de verdad

Todos los marcadores de entidades operativas deben salir de:

```text
src/lib/alentoMapMarker.ts
```

No duplicar HTML, emojis, colores, iconos o estilos de pines dentro de componentes.

## Pines oficiales

### Alentó Pizza

Usar `createAlentoMapPinElement()`.

Representa el origen/tienda y mantiene la identidad visual oficial de Alentó.

### Repartidor

Usar `createDriverMapPinElement()`.

Visual oficial:

- aro exterior blanco;
- centro negro;
- moto amarilla;
- sombra suave.

Debe verse igual en el mapa principal del repartidor, navegación del repartidor, seguimiento del cliente y cualquier mapa futuro donde aparezca un repartidor.

En la pantalla **Navegación** del repartidor, el mapa no debe incluir Alentó Pizza dentro del encuadre operativo. Esa vista representa únicamente:

`repartidor actual → destino del cliente`

El `fitBounds` debe construirse con la ubicación viva del repartidor, el destino y la polilínea vigente. Como la ruta se recalcula durante el desplazamiento, el mapa debe acercarse progresivamente al destino.

### Domicilio / destino

Usar `createDeliveryMapPinElement(orderCode)`.

Reglas:

- rojo Alentó;
- si el mapa ya corresponde a un pedido creado, mostrar dentro del pin el consecutivo visible del pedido;
- usar el código real, por ejemplo `POS-0026` o `WEB-0041`; el helper extrae `26` o `41`;
- si aún no existe pedido —checkout o edición de dirección— usar `createDeliveryMapPinElement()` sin número;
- no usar el pin predeterminado de Google para un domicilio de Alentó.
- en rutas con múltiples entregas usar `createDeliveryRouteStopPinElement(orderCode, stopNumber, routeColor)`; el número principal sigue siendo el pedido y el badge pequeño identifica `Parada 1`, `Parada 2`, etc.;
- el `routeColor` debe corresponder al tramo que llega a esa parada, no al repartidor completo: `Moto → Parada 1` y `Parada 1 → Parada 2` usan colores distintos aunque pertenezcan al mismo repartidor.
- en el mapa principal del repartidor, cuando tiene 2 o más domicilios propios con ubicación, solo esos pines asignados muestran el badge `1, 2, 3...`; solicitudes sin asignar conservan únicamente el número del pedido.
- en la vista del repartidor, los domicilios asignados al propio repartidor usan tono esmeralda tanto en el pin como en la tarjeta; las solicitudes todavía libres conservan el pin rojo y la tarjeta neutral. El color del estado de cocina sigue siendo independiente de esta distinción.
- en el `Mapa De Entregas` del panel administrativo se usa la misma semántica: pin esmeralda = pedido con repartidor asignado, pin rojo = pedido disponible/sin repartidor. Si el pedido forma parte de una ruta múltiple, el pin base sigue siendo esmeralda y el badge pequeño conserva el color específico del tramo.
- el orden de paradas se calcula con la misma heurística compartida `orderDeliveryStopsByProximity()` usada por el mapa operativo del administrador.

## Implementación

Para estas entidades, preferir Google Maps `AdvancedMarkerElement`.

No crear nuevos:

- `google.maps.Marker` para tienda, repartidor o domicilio;
- labels manuales con `🏠`, `🛵`, letras o números;
- copias locales de helpers de marcadores.

Si un flujo necesita un marcador draggable o interactivo, adaptar el marcador compartido a `AdvancedMarkerElement` antes de crear un estilo alternativo.

## Mapas migrados

La regla se aplica en:

- `src/components/DriverHome.tsx`;
- `src/components/DriverDestinationActions.tsx`;
- `src/components/CustomerDeliveryLiveMap.tsx`;
- `src/components/PublicCheckoutDelivery.tsx`;
- `src/components/GoogleCustomerAddressPicker.tsx`;
- `src/components/StoreOriginMapPicker.tsx`.

## No regresión

Todo mapa nuevo debe revisar este documento y `src/lib/alentoMapMarker.ts` antes de implementar marcadores.

Si cambia el diseño oficial de un pin, modificar el helper compartido para que todas las superficies hereden el cambio. No corregir cada mapa por separado.
