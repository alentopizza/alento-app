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
- Creación y edición de clientes desde el POS.
- Validación de dirección para Domicilio.
- Catálogo por categorías.
- Productos simples, pizzas, dos sabores, tamaños, bordes, ingredientes extra y combos configurables.
- Carrito con cantidades y subtotal.
- Modal de cierre del pedido.
- Selección manual de zona/tarifa de domicilio desde Configuración.
- Selección de medio de pago desde Configuración.
- Descuento mediante cupón o descuento manual.
- Revisión de subtotal, domicilio, descuento y total.
- El cierre validado se refleja en el resumen lateral.
- El bloque inferior del resumen lateral permanece visible en escritorio para evitar scroll innecesario.

### Cupones

Existe una pestaña propia `/cupones` para administrar descuentos reutilizables.

Cada cupón tiene:

- nombre;
- tipo `FIXED` (plano) o `PERCENTAGE` (porcentaje);
- valor;
- estado activo/inactivo.

Ejemplos esperados:

- `Cupón Trabajador` → porcentaje → `60%`.
- `Cupón Fidelización` → plano → `$10.000`.

Los cupones activos aparecen automáticamente en el popup de cierre del POS.

### Clientes

- Directorio, búsqueda y edición.
- Dirección principal.
- Protección contra eliminación de clientes con pedidos asociados.

### Menú

- Administración de categorías y productos.
- Categoría Combos.
- Reglas configurables de combos.

### Configuración

- Ubicación del local.
- Zonas/tarifas de domicilio editables por nombre, costo y estado.
- Medios de pago configurables.
- Persistencia mediante `AppSetting`.
- Los rangos históricos en metros se conservan internamente para futura automatización con mapas.

### APIs

- Catálogo.
- Clientes.
- Administración de menú.
- Configuración.
- Cupones: `/api/coupons` y `/api/coupons/[id]`.
- `/api/delivery/quote` se conserva para futura integración automática basada en distancia.

## Flujo de cierre actual

### Domicilio

1. Cliente seleccionado y con dirección.
2. Abrir cierre.
3. Seleccionar zona/tarifa de domicilio.
4. Elegir descuento: sin descuento, cupón o manual.
5. Elegir medio de pago.
6. Revisar subtotal, domicilio, descuento y total.
7. Validar cierre.

### Recoger en tienda

1. Cliente seleccionado.
2. Abrir cierre.
3. Elegir descuento: sin descuento, cupón o manual.
4. Elegir medio de pago.
5. Revisar pedido.
6. Validar cierre.

### Local

1. Cliente opcional.
2. Abrir cierre.
3. Elegir descuento: sin descuento, cupón o manual.
4. Elegir medio de pago.
5. Revisar pedido.
6. Validar cierre.

Importante: validar el cierre todavía NO crea un `Order` en PostgreSQL.

## Reglas de descuentos

Un pedido solo puede tener una fuente de descuento operativo:

- `NONE`: sin descuento;
- `COUPON`: cupón administrado desde `/cupones`;
- `MANUAL`: valor escrito manualmente por el operador.

No se permite combinar cupón + descuento manual.

### Cupón porcentual

El porcentaje se calcula únicamente sobre el subtotal de productos. El domicilio no forma parte de la base del porcentaje.

Ejemplo:

- subtotal productos: $50.000;
- domicilio: $10.000;
- Cupón Trabajador: 60%;
- descuento: $30.000;
- total: $30.000.

### Cupón plano

El valor fijo se descuenta del subtotal de productos y nunca puede reducir los productos por debajo de $0. El domicilio permanece intacto.

### Descuento manual

Se mantiene para excepciones operativas. Puede descontar hasta el valor completo de `subtotal + deliveryFee` y nunca puede dejar un total negativo.

## Persistencia futura del descuento

Prisma incluye ahora el modelo `Coupon` y `Order` dispone de:

- `couponId` opcional;
- `couponName` opcional como snapshot del nombre usado;
- `discount` como valor monetario finalmente aplicado.

La intención es que un pedido histórico conserve el valor final aplicado incluso si el cupón cambia posteriormente.

## Base de datos / despliegue

La incorporación de cupones agrega el modelo `Coupon` y nuevas columnas en `Order`. Como este proyecto continúa usando sincronización manual de Prisma, después de desplegar esta versión se debe ejecutar una vez en la consola del servicio:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` mientras la base de producción siga sin baseline formal.

## Decisión sobre Google Maps

Google Maps NO es dependencia operativa en esta etapa. La selección de tarifa de domicilio sigue siendo manual para maximizar estabilidad. La futura integración con mapas deberá automatizar solamente la selección de zona/tarifa.

## Pendiente inmediato

Después de aprobar cupones, el siguiente bloque es la persistencia real del pedido:

1. Endpoint de creación.
2. Crear `Order` con tipo, cliente, dirección, subtotal, domicilio, descuento, cupón y total.
3. Crear `OrderItem` por cada línea.
4. Conservar configuración de pizzas y combos para Cocina e historial.
5. Crear `Payment` con el medio validado.
6. Confirmar pedido, limpiar POS y enviar a Cocina.
7. Habilitar pantalla de Pedidos.

## Regla de continuidad

Antes de iniciar una funcionalidad importante, actualizar este documento y/o `ARCHITECTURE.md` si cambia una decisión estructural.
