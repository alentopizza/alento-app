# Estado actual del proyecto

Última actualización: 2026-09-16.

Este documento resume qué está funcionando hoy y cuál es el siguiente bloque aprobado de desarrollo.

## Ya implementado

### POS

- Selección inicial de tipo de pedido.
- Domicilio, Recoger en tienda y Local.
- Cliente obligatorio para Domicilio.
- Cliente obligatorio para Recoger en tienda.
- Cliente opcional para Local.
- Búsqueda de clientes.
- Creación de clientes desde el POS.
- Edición de clientes desde el POS.
- Validación de dirección para Domicilio.
- Catálogo por categorías.
- Productos simples.
- Pizzas de un sabor.
- Pizza de dos sabores.
- Tamaños.
- Bordes.
- Ingredientes extra.
- Combos configurables.
- Combos con descuento fijo.
- Carrito con cantidades y subtotal.

### Clientes

- Directorio.
- Búsqueda.
- Edición.
- Dirección principal.
- Protección contra eliminación de clientes con pedidos asociados.

### Menú

- Administración de categorías y productos.
- Categoría Combos.
- Reglas configurables de combos.

### Configuración

- Ubicación del local.
- Rangos de cobertura y tarifa de domicilio.
- Activación y edición de rangos.
- Medios de pago configurables.
- Persistencia mediante `AppSetting`.

### APIs

- Catálogo.
- Clientes.
- Administración de menú.
- Configuración.
- Cotización de domicilio por distancia conocida.

## Pendiente inmediato

El siguiente bloque es el cierre operativo del pedido.

### Domicilio

1. Leer la dirección seleccionada del cliente.
2. Obtener o capturar la distancia al local.
3. Consultar `/api/delivery/quote`.
4. Mostrar si existe cobertura.
5. Aplicar automáticamente `deliveryFee`.
6. Elegir medio de pago desde los métodos activos de Configuración.
7. Mostrar revisión final.
8. Crear el pedido persistente en PostgreSQL.
9. Crear el pago asociado.
10. Enviar el pedido a Cocina.

### Recoger en tienda

1. Cliente ya seleccionado.
2. Medio de pago.
3. Revisión final.
4. Crear pedido y pago.
5. Enviar a Cocina.

### Local

1. Cliente opcional.
2. Medio de pago.
3. Revisión final.
4. Crear pedido y pago.
5. Enviar a Cocina.

## Decisión pendiente: cálculo automático de distancia

Todavía no hay integración con un proveedor de mapas.

Mientras esto no exista, `/api/delivery/quote` solo debe recibir una distancia ya conocida. No inferir distancias desde texto de dirección.

La integración futura debe resolver:

- geocodificación de dirección;
- coordenadas del local;
- distancia o ruta;
- manejo de errores de dirección;
- costos y límites del proveedor.

## Próximos módulos después del cierre del pedido

1. Persistencia real de pedidos.
2. Pantalla Pedidos.
3. Cocina conectada a pedidos reales.
4. Caja y conciliación de pagos.
5. Integración con Chatwoot.
6. App para clientes.

## Regla de continuidad

Antes de iniciar una nueva funcionalidad importante, actualizar este documento y/o `ARCHITECTURE.md` si cambia una decisión estructural.
