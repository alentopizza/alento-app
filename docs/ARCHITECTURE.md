# Arquitectura de Alentó App

Este documento describe cómo está organizada Alentó App, cuál es la responsabilidad de cada módulo y qué decisiones deben respetarse al continuar el desarrollo.

## Objetivo del proyecto

Alentó App es la aplicación operativa propia de Alentó Pizza. Su objetivo es reemplazar gradualmente Glide y convertirse en la fuente principal de verdad para:

- clientes;
- catálogo y precios;
- construcción de pedidos;
- pedidos y estados;
- cocina;
- caja y pagos;
- configuración operativa;
- futuras integraciones con Chatwoot y canales de venta.

Chatwoot no debe convertirse en un segundo sistema de pedidos. En la arquitectura objetivo, Chatwoot es un canal de atención y Alentó App conserva la lógica y los datos del pedido.

## Stack

- Next.js 15 con App Router.
- React 19.
- TypeScript.
- Tailwind CSS 4.
- Prisma 6.
- PostgreSQL.
- EasyPanel sobre VPS para despliegue.

## Infraestructura

- Proyecto EasyPanel: `app_alento`.
- Servicio web: `alento-app`.
- Servicio PostgreSQL: `alento-db`.
- Dominio POS: `https://pos.alentopizza.com/`.
- PostgreSQL es accesible por la aplicación usando `DATABASE_URL` dentro de la red interna de EasyPanel.

## Módulos principales

### `/`

Punto de venta. Actualmente contiene:

- selección de tipo de pedido;
- búsqueda, selección, creación y edición de cliente;
- catálogo por categorías;
- pizzas de un sabor;
- pizza de dos sabores;
- selección de tamaño;
- selección de borde;
- ingredientes extra;
- combos configurables;
- carrito y cantidades;
- subtotal y resumen del pedido;
- cierre con tarifa de domicilio y forma de pago.

### `/clientes`

Directorio de clientes. Permite consultar y editar clientes existentes. Los pedidos a domicilio y recoger en tienda deben quedar asociados a un cliente para mantener historial.

### `/menu`

Administración de categorías y productos. Contiene la configuración comercial del catálogo, incluyendo pizzas, modificadores y combos.

### `/cocina`

Módulo destinado a recibir pedidos confirmados y moverlos por estados operativos. La estructura visual existe, pero su flujo real depende de terminar primero la creación persistente de pedidos.

### `/configuracion`

Configuración operativa persistente. Contiene:

- ubicación del local como referencia;
- zonas/tarifas de domicilio;
- medios de pago activos.

Estos datos no deben quedar codificados en el POS. El POS debe consumirlos desde la API de configuración.

## Tipos de pedido

El modelo maneja tres tipos:

- `DELIVERY`: Domicilio.
- `PICKUP`: Recoger en tienda.
- `STORE`: Consumo en el local.

Reglas actuales:

- Domicilio: cliente obligatorio y dirección obligatoria.
- Recoger en tienda: cliente obligatorio para conservar historial.
- Local: cliente opcional.

## Flujo del POS

La secuencia operativa aprobada es:

1. Tipo de pedido.
2. Cliente cuando corresponde.
3. Productos y configuración.
4. Cierre del pedido.
5. Tarifa de domicilio cuando corresponde.
6. Medio de pago.
7. Revisión final.
8. Creación persistente del pedido.
9. Envío a Cocina.

No volver a pedir el tipo de pedido al final: debe quedar definido desde el inicio.

## Configuración operativa

La tabla `AppSetting` guarda configuraciones de aplicación en JSON. Actualmente se usa la clave `pos_settings`.

La configuración incluye:

```ts
{
  store: {
    address: string,
    mapsUrl: string
  },
  deliveryBands: [
    {
      id: string,
      name: string,
      minMeters: number,
      maxMeters: number,
      fee: number,
      active: boolean
    }
  ],
  paymentMethods: [
    {
      id: string,
      name: string,
      active: boolean
    }
  ]
}
```

En la operación actual, `deliveryBands` funciona como catálogo de zonas/tarifas seleccionables manualmente. El operador ve principalmente `name`, `fee` y `active`.

Ejemplos:

- Zona cercana: $0.
- Zona intermedia: $5.000.
- Zona extendida: $10.000.

Los campos `minMeters` y `maxMeters` se conservan como metadatos internos para una futura automatización con mapas, pero no deben pedirse al operador ni mostrarse como requisito del flujo actual.

Medios de pago iniciales:

- Efectivo.
- Nequi.
- DaviPlata.
- Tarjeta.
- Llave.

Todos estos valores son editables desde Configuración y no deben asumirse como permanentes en código nuevo.

## APIs relevantes

### `/api/catalog`

Devuelve el catálogo necesario para construir pedidos en el POS.

### `/api/customers`

Consulta y crea clientes.

### `/api/customers/[id]`

Actualiza y elimina clientes según las reglas existentes.

### `/api/settings`

- `GET`: obtiene la configuración operativa.
- `PUT`: guarda la configuración operativa.

### `/api/delivery/quote`

Se conserva como pieza futura para automatizar una tarifa a partir de distancia. No es necesaria para el flujo manual actual.

## Zonas, distancia y mapas

Decisión arquitectónica actual: Google Maps no es una dependencia operativa.

El operador selecciona manualmente una zona/tarifa activa durante el cierre del pedido. Esto evita que el POS dependa de geocodificación, API keys, facturación, cuotas o errores de direcciones.

La automatización futura podrá:

1. geocodificar la dirección del cliente;
2. calcular distancia o ruta desde el local;
3. usar `minMeters`/`maxMeters` o reglas equivalentes para identificar la zona;
4. seleccionar automáticamente la tarifa ya configurada.

La futura integración con mapas debe automatizar la selección, no reemplazar la Configuración como fuente de verdad comercial.

## Datos de pedidos

Prisma ya contiene modelos para:

- `Order`;
- `OrderItem`;
- `Payment`;
- `Customer`;
- `CustomerAddress`.

`Order` ya dispone de `deliveryFee`, `discount`, `subtotal`, `total`, `fulfillmentType`, `source` y relación con pagos.

## Principio de diseño

El POS, Chatwoot y la futura app de clientes deben terminar usando el mismo motor de pedidos y las mismas reglas de catálogo, cobertura, precios y pagos. Evitar duplicar lógica comercial en cada canal.
