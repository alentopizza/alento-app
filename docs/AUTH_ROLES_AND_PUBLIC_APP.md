# Autenticación, roles y app pública

Este documento define la arquitectura objetivo para proteger el sistema interno de Alentó App y convivir con la futura experiencia pública de pedidos de clientes.

## Estado actual

A septiembre de 2026 el proyecto todavía **no tiene autenticación ni autorización implementadas**.

Actualmente no existe un modelo de usuario interno, sesión, login, middleware de protección ni control de permisos por rol. Las rutas y APIs internas deben considerarse en etapa de desarrollo hasta que este bloque sea implementado.

No se debe asumir que ocultar enlaces en la interfaz protege una función. La protección debe existir también del lado servidor para páginas y APIs.

## Objetivo de producto

Alentó App debe funcionar desde **una sola URL principal**.

La arquitectura objetivo no requiere un dominio distinto para POS, Cocina, Caja o la futura app pública. El mismo dominio servirá contenido diferente según la ruta y los permisos del usuario.

Objetivo futuro:

```text
alentopizza.com/
├── experiencia pública del cliente
├── menú
├── carrito
├── checkout
└── seguimiento del pedido

alentopizza.com/interno
├── login de empleados
├── POS
├── Pedidos
├── Cocina
├── Clientes
├── Caja
├── Menú administrativo
├── Cupones
└── Configuración
```

La estructura exacta de rutas puede evolucionar, pero la decisión de producto es mantener una sola URL y controlar el acceso mediante autenticación y permisos.

## Situación actual del dominio

`alentopizza.com` continúa ocupado por la aplicación actual construida en Glide.

Mientras Alentó App termina su etapa de construcción y validación, la infraestructura actual puede seguir usando rutas o dominios temporales como el POS existente.

Cuando Alentó App esté lista para reemplazar Glide, el dominio principal `alentopizza.com` debe apuntar a esta aplicación. A partir de ese momento la experiencia pública y el sistema interno convivirán en el mismo host.

No diseñar la plataforma suponiendo que cada módulo necesita su propio dominio.

## Separación conceptual: clientes y empleados

`Customer` representa a la persona que compra y no debe reutilizarse como usuario administrativo.

Debe existir un modelo independiente para personal interno, por ejemplo:

```prisma
model User {
  id           Int      @id @default(autoincrement())
  name         String
  email        String   @unique
  passwordHash String
  role         UserRole
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

El diseño final puede evolucionar a permisos múltiples, pero clientes y empleados deben seguir siendo conceptos separados.

## Roles iniciales propuestos

Primera versión:

- `ADMIN`: acceso completo y administración del sistema.
- `POS`: toma de pedidos, clientes y consulta operativa de pedidos.
- `KITCHEN`: acceso a Cocina y únicamente a los datos necesarios para preparar órdenes.
- `CASHIER`: pedidos, registro de pagos y Caja.
- `DISPATCH`: gestión de órdenes listas, domicilio y entrega.

Los roles son una primera capa. Más adelante puede ser conveniente evolucionar a permisos granulares si distintos negocios requieren combinaciones diferentes.

## Principio de mínimo acceso

Cada puesto debe ver solo lo que necesita para trabajar.

Ejemplos:

- Cocina no necesita acceso a Configuración, Cupones o administración de Caja.
- Un usuario de Cocina tampoco debería necesitar toda la información financiera del pedido.
- Caja no necesita poder modificar recetas o configuración técnica del catálogo.
- Solo roles autorizados deben poder eliminar registros o cambiar configuraciones críticas.

## Protección obligatoria

La futura autenticación debe proteger dos capas.

### Interfaz / páginas

Una persona sin sesión no debe poder abrir módulos internos escribiendo manualmente la URL.

### APIs

La protección principal debe estar del lado servidor.

No debe ser posible invocar sin autorización endpoints internos para:

- crear, editar, cancelar o eliminar pedidos;
- registrar o eliminar pagos;
- consultar Caja;
- editar clientes;
- cambiar configuración;
- administrar productos o cupones;
- cambiar estados operativos.

Ocultar un botón no reemplaza una autorización de servidor.

## Sesiones y contraseñas

Requisitos mínimos de seguridad:

- contraseñas almacenadas únicamente como hash seguro;
- nunca guardar contraseñas en texto plano;
- sesión persistida mediante mecanismo seguro;
- cookies de sesión `HttpOnly`;
- cookies `Secure` en producción;
- expiración y cierre de sesión;
- usuario `active = false` debe perder acceso;
- autorización validada en servidor en cada operación sensible.

La librería concreta de autenticación todavía no está seleccionada. Debe elegirse antes de implementar este bloque y documentarse en `package.json`, `docs/ARCHITECTURE.md` y `docs/DEPLOYMENT.md`.

## App pública de clientes

La futura experiencia estilo aplicación de delivery reutilizará el mismo backend comercial de Alentó App.

Debe consumir las mismas reglas de:

- catálogo;
- disponibilidad;
- tamaños, sabores, bordes y modificadores;
- combos;
- precios;
- descuentos y cupones;
- zonas/tarifas de domicilio;
- clientes;
- pedidos;
- pagos;
- configuración estructurada de `OrderItem`.

No debe existir un segundo motor de pedidos para la web.

Los pedidos públicos usarán `Order.source = WEB` y compartirán el mismo consecutivo comercial global con POS.

Ejemplo:

```text
POS-0001
POS-0002
WEB-0003
POS-0004
```

El prefijo identifica el origen; el número se comparte entre todos los canales.

## Plan de implementación por pasos pequeños

Este bloque debe implementarse gradualmente para reducir riesgo:

1. Agregar `User` y `UserRole` a Prisma.
2. Elegir e instalar la solución de autenticación.
3. Implementar login/logout y hash de contraseñas.
4. Implementar sesión segura.
5. Proteger una ruta piloto, preferiblemente `/cocina`.
6. Proteger todas las páginas internas.
7. Proteger todas las APIs internas.
8. Aplicar permisos por rol en servidor.
9. Adaptar navegación para mostrar únicamente módulos autorizados.
10. Crear administración de usuarios para `ADMIN`.
11. Registrar auditoría para operaciones sensibles cuando sea necesario.
12. Reorganizar progresivamente las rutas internas bajo `/interno` si se aprueba el cambio.
13. Construir la experiencia pública en `/` cuando se prepare el reemplazo de Glide.
14. Migrar `alentopizza.com` desde Glide hacia Alentó App en el corte de producción.

No es necesario ejecutar todos los pasos en un solo cambio.

## Portabilidad y comercialización

El proyecto debe poder replicarse para otros restaurantes sin reescribir su núcleo.

Por eso se deben mantener separados:

- motor de pedidos;
- autenticación y permisos;
- reglas comerciales configurables;
- identidad visual / marca;
- datos propios del restaurante;
- infraestructura y secretos de cada instalación.

Evitar codificar en lógica de negocio valores exclusivos de Alentó Pizza cuando puedan ser configuración.

Una futura instalación para otro negocio debería poder cambiar nombre, logotipo, catálogo, colores, tarifas, medios de pago, usuarios y dominio sin modificar el flujo central de pedidos.

Esto no significa que el sistema sea multi-tenant hoy. La arquitectura actual es una instalación por negocio. La posibilidad de convertirlo en un producto multi-negocio debe evaluarse por separado antes de introducir complejidad de tenancy.

## Criterio para considerar seguro el sistema interno

El sistema interno no debe considerarse listo para exposición pública en `alentopizza.com` hasta que:

- exista login;
- exista sesión segura;
- las páginas internas estén protegidas;
- las APIs internas estén protegidas;
- los permisos de rol se validen en servidor;
- exista al menos un flujo seguro para crear/desactivar usuarios;
- la configuración de producción tenga secretos y cookies correctamente configurados.

Hasta entonces, cualquier despliegue accesible desde Internet debe considerarse un entorno de construcción/validación y no un sistema interno protegido.