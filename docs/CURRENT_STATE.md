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
- Modal de cierre del pedido en diseño compacto.
- Selección manual de zona/tarifa de domicilio desde Configuración.
- Selección de medio de pago desde Configuración.
- Descuento mediante cupón o descuento manual.
- Cálculo de subtotal elegible para descuentos.
- Exclusión automática de combos y productos promocionales del descuento.
- Revisión de subtotal, domicilio, descuento y total.
- Para pagos en Efectivo, captura de `Paga con` y cálculo automático de `Vueltas`.
- Botones rápidos de efectivo: pago exacto y denominaciones sugeridas iguales o superiores al total.
- Validación que impide cerrar un pago en efectivo si `Paga con` es menor al total.
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
- `Product.couponEligible` define si un producto normal puede participar en descuentos.
- Los productos `COMBO` son siempre no elegibles para cupones aunque el campo anterior estuviera activo.

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
- Elegibilidad de descuentos: `/api/discount/eligibility`.
- `/api/delivery/quote` se conserva para futura integración automática basada en distancia.

## Flujo de cierre actual

### Domicilio

1. Cliente seleccionado y con dirección.
2. Abrir cierre.
3. Seleccionar zona/tarifa de domicilio.
4. El sistema calcula la base elegible de productos.
5. Elegir descuento: sin descuento, cupón o manual.
6. Elegir medio de pago.
7. Si el medio es Efectivo, ingresar `Paga con`.
8. El sistema calcula `Vueltas = Paga con - Total`.
9. Revisar subtotal, domicilio, descuento, total y vueltas.
10. Validar cierre.

### Recoger en tienda

1. Cliente seleccionado.
2. Abrir cierre.
3. El sistema calcula la base elegible de productos.
4. Elegir descuento: sin descuento, cupón o manual.
5. Elegir medio de pago.
6. Si es Efectivo, ingresar `Paga con` y calcular vueltas para caja.
7. Revisar pedido.
8. Validar cierre.

### Local

1. Cliente opcional.
2. Abrir cierre.
3. El sistema calcula la base elegible de productos.
4. Elegir descuento: sin descuento, cupón o manual.
5. Elegir medio de pago.
6. Si es Efectivo, ingresar `Paga con` y calcular vueltas para caja.
7. Revisar pedido.
8. Validar cierre.

Importante: validar el cierre todavía NO crea un `Order` en PostgreSQL.

## Regla de efectivo y vueltas

La forma de pago `Efectivo` tiene información adicional que no aplica a otros medios de pago:

- `cashReceived`: valor con el que paga el cliente (`Paga con`).
- `changeDue`: vueltas que deben entregarse al cliente.

Reglas:

- `cashReceived` debe ser igual o mayor al total del pedido;
- `changeDue = cashReceived - total`;
- para Domicilio, este dato indica cuánto cambio debe llevar el domiciliario;
- para Local o Recoger en tienda, indica cuánto debe devolver el cajero;
- si el cliente paga exacto, `changeDue = 0`;
- estos valores deben persistirse en `Payment` cuando se active la creación real del pedido.

Prisma ya contiene campos opcionales `Payment.cashReceived` y `Payment.changeDue` para este fin.

## Reglas de descuentos

Un pedido solo puede tener una fuente de descuento operativo:

- `NONE`: sin descuento;
- `COUPON`: cupón administrado desde `/cupones`;
- `MANUAL`: valor escrito manualmente por el operador.

No se permite combinar cupón + descuento manual.

### Base elegible

Los descuentos se calculan únicamente sobre productos elegibles.

Reglas:

- el domicilio nunca forma parte de la base de descuento;
- los productos `COMBO` nunca acumulan cupones ni descuento manual;
- cualquier producto con `couponEligible = false` queda excluido;
- futuras promociones u ofertas que ya reduzcan el precio original deben marcar el producto como `couponEligible = false`;
- el servidor calcula la base elegible mediante `/api/discount/eligibility`; el navegador no decide por sí solo qué líneas son elegibles.

El cierre muestra dos cifras al operador:

- `Base elegible`: productos que sí pueden recibir descuento;
- `Promos excluidas`: productos que ya tienen una promoción o no acumulan.

### Cupón porcentual

El porcentaje se calcula únicamente sobre la base elegible.

Ejemplo:

- pizza normal: $40.000;
- combo promocional: $30.000;
- domicilio: $10.000;
- base elegible: $40.000;
- Cupón Trabajador: 60%;
- descuento: $24.000;
- total: $56.000.

El combo y el domicilio no reciben el 60%.

### Cupón plano

El valor fijo se descuenta únicamente de la base elegible y queda limitado a ella.

Ejemplo: si el cupón es de $10.000 pero solo existen $7.000 en productos elegibles, el descuento aplicado será $7.000.

### Descuento manual

El descuento manual también respeta la base elegible. No puede reducir combos, promociones ni domicilio. Su máximo es el valor de `Base elegible`.

## Persistencia futura del descuento

Prisma incluye el modelo `Coupon` y `Order` dispone de:

- `couponId` opcional;
- `couponName` opcional como snapshot del nombre usado;
- `discount` como valor monetario finalmente aplicado.

La intención es que un pedido histórico conserve el valor final aplicado incluso si el cupón cambia posteriormente.

## Base de datos / despliegue

El schema actual incluye:

- modelo `Coupon`;
- columnas de cupón en `Order`;
- `Product.couponEligible`;
- `Payment.cashReceived`;
- `Payment.changeDue`.

Como este proyecto continúa usando sincronización manual de Prisma, después de desplegar una versión que aún no tenga estos cambios aplicados en producción se debe ejecutar una vez en la consola del servicio:

```bash
npx prisma db push
```

No usar `prisma migrate deploy` mientras la base de producción siga sin baseline formal.

## Decisión sobre Google Maps

Google Maps NO es dependencia operativa en esta etapa. La selección de tarifa de domicilio sigue siendo manual para maximizar estabilidad. La futura integración con mapas deberá automatizar solamente la selección de zona/tarifa.

## Pendiente inmediato

El siguiente bloque es la persistencia real del pedido:

1. Endpoint de creación.
2. Crear `Order` con tipo, cliente, dirección, subtotal, domicilio, descuento, cupón y total.
3. Crear `OrderItem` por cada línea.
4. Conservar configuración de pizzas y combos para Cocina e historial.
5. Crear `Payment` con medio, valor pagado y, cuando sea efectivo, `cashReceived` y `changeDue`.
6. Confirmar pedido, limpiar POS y enviar a Cocina.
7. Habilitar pantalla de Pedidos.

## Regla de continuidad

Antes de iniciar una funcionalidad importante, actualizar este documento y/o `ARCHITECTURE.md` si cambia una decisión estructural.