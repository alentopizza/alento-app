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
- Modal de cierre del pedido.
- Validación manual temporal de distancia para Domicilio.
- Consulta a `/api/delivery/quote` para determinar cobertura y tarifa.
- Selección de medio de pago desde los métodos activos de Configuración.
- Revisión de subtotal, domicilio y total antes de persistir el pedido.
- El resultado del cierre validado se refleja de nuevo en el resumen lateral del POS.

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

## Flujo de cierre actual

### Domicilio

1. Cliente ya seleccionado y con dirección registrada.
2. Abrir cierre del pedido.
3. Capturar manualmente la distancia en metros desde el local.
4. Consultar `/api/delivery/quote`.
5. Validar cobertura.
6. Aplicar la tarifa de domicilio configurada.
7. Elegir un medio de pago activo.
8. Revisar productos, subtotal, domicilio y total.
9. Validar el cierre.

### Recoger en tienda

1. Cliente ya seleccionado.
2. Abrir cierre del pedido.
3. Elegir medio de pago.
4. Revisar el pedido.
5. Validar el cierre.

### Local

1. Cliente opcional.
2. Abrir cierre del pedido.
3. Elegir medio de pago.
4. Revisar el pedido.
5. Validar el cierre.

Importante: validar el cierre todavía NO crea un `Order` en PostgreSQL. Este paso es intencional para aprobar primero el flujo operativo antes de persistir pedidos reales.

## Pendiente inmediato

El siguiente bloque aprobado es la persistencia real del pedido.

Debe incluir:

1. Endpoint de creación de pedido.
2. Crear `Order` con tipo de pedido, cliente, dirección, subtotal, domicilio y total.
3. Crear `OrderItem` para cada línea del carrito.
4. Conservar suficiente configuración de pizzas y combos dentro de `configuration` para Cocina e historial.
5. Crear `Payment` con el medio de pago validado.
6. Definir correctamente el estado inicial del pago.
7. Confirmar el pedido y limpiar el POS después de una creación exitosa.
8. Conectar el pedido nuevo a Cocina.
9. Crear o habilitar la pantalla de Pedidos.

## Decisión pendiente: cálculo automático de distancia

Todavía no hay integración con un proveedor de mapas.

Mientras esto no exista, `/api/delivery/quote` solo debe recibir una distancia ya conocida. No inferir distancias desde texto de dirección.

La captura manual del cierre está marcada visualmente como temporal. La futura integración debe reemplazar solamente la obtención de `distanceMeters`; las reglas de cobertura y tarifas seguirán viviendo en Configuración.

La integración futura debe resolver:

- geocodificación de dirección;
- coordenadas del local;
- distancia o ruta;
- manejo de errores de dirección;
- costos y límites del proveedor.

## Próximos módulos después de persistir pedidos

1. Pantalla Pedidos.
2. Cocina conectada a pedidos reales.
3. Caja y conciliación de pagos.
4. Integración con Chatwoot.
5. App para clientes.

## Regla de continuidad

Antes de iniciar una nueva funcionalidad importante, actualizar este documento y/o `ARCHITECTURE.md` si cambia una decisión estructural.
