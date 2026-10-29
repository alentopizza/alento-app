# Sistema visual y tipográfico de Alentó

Última actualización: 2026-10-25.

Este documento es la fuente canónica para tipografía operativa en superficies internas de Alentó App.

## Fuente

Usar siempre la pila de sistema definida en `src/app/globals.css`:

```css
system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif
```

No introducir fuentes externas salvo decisión explícita de marca.

## Escala tipográfica operativa

La escala oficial vive en variables CSS globales:

| Rol | Variable | Tamaño | Peso |
| --- | --- | ---: | ---: |
| Micro | `--ui-text-micro` | 10 px | 600 |
| Label | `--ui-text-label` | 11 px | 700 |
| Control | `--ui-text-control` | 13 px | 600 |
| Body | `--ui-text-body` | 14 px | 500 |
| Status / valor | `--ui-text-status` | 16 px | 700 |
| Title | `--ui-text-title` | 20 px | 800 |

Clases reutilizables:

- `.alento-ui-micro`
- `.alento-ui-label`
- `.alento-ui-control`
- `.alento-ui-body`
- `.alento-ui-status`
- `.alento-ui-title`

## Uso

### Micro — 10 px / 600

Usar para:

- fecha/hora secundaria;
- ayudas;
- metadatos;
- observaciones breves;
- información secundaria no crítica.

No usar texto funcional por debajo de 10 px.

### Label — 11 px / 700

Usar para:

- rótulos de campos;
- etiquetas de métricas;
- badges/estados compactos;
- pequeños encabezados en mayúscula.

### Control — 13 px / 600

Usar para:

- botones;
- inputs;
- selects;
- acciones;
- nombre principal dentro de tarjetas compactas.

### Body — 14 px / 500

Usar para:

- descripciones;
- mensajes explicativos;
- textos de lectura normal.

### Status / valor — 16 px / 700

Usar para:

- valores monetarios;
- cifras operativas;
- estados o datos que requieren lectura inmediata.

### Title — 20 px / 800

Usar para:

- títulos de módulos secundarios;
- encabezados de modal;
- títulos de sección.

Los headers hero de módulos pueden usar una escala mayor ya aprobada por su componente visual, pero no deben introducir tamaños arbitrarios nuevos.

## Pesos

- Evitar `font-black` en microtexto.
- Para labels y acciones usar 600–700.
- Reservar 800 para títulos.
- La UI debe sentirse clara y moderna, no pesada.

## Regla de implementación

No crear nuevos `text-[7px]`, `text-[8px]` o `text-[9px]` para UI funcional.

Para nuevas superficies:

1. elegir el rol tipográfico;
2. usar la clase `.alento-ui-*` correspondiente;
3. solo crear una excepción si existe una necesidad visual documentada.

La impresión térmica queda excluida porque tiene requisitos físicos distintos.

## Semántica de color

Cuando el estado represente dinero/operación:

- verde: pagado, recuperado, completado o correcto;
- ámbar/naranja: pendiente o por resolver;
- rojo: error, faltante, riesgo o acción destructiva;
- neutral: información sin estado.

No usar verde para una obligación pendiente.


## Compatibilidad heredada

Mientras existan componentes antiguos con tamaños locales, `src/app/globals.css` normaliza automáticamente:

- `7px / 8px` → Micro (10 px);
- `9px / 11px` → Label (11 px);
- `10px` → Micro (10 px);
- `12px` → Control (13 px);
- `font-black` en textos pequeños → peso 700.

La impresión térmica queda excluida.

Esta capa es de compatibilidad. Todo componente nuevo o refactorizado debe usar directamente las clases `.alento-ui-*`.


## Tarjeta canónica de producto

La tarjeta de producto del menú público es la referencia visual compartida para catálogo.

Se reutiliza en:

- menú del cliente;
- POS;
- menú administrativo.

Clases fuente:

`.alento-product-card*` en `src/app/globals.css`.

No duplicar esta estructura en componentes. Las superficies administrativas pueden superponer controles operativos, pero deben conservar la misma tarjeta base.


## Hub de Configuración

La ruta `/configuracion` funciona como un centro de accesos y no como una página continua de formularios.

Patrón:

- header compacto estándar de 116 px;
- cards de acceso para cada área real de configuración;
- una sola sección visible a la vez;
- la lógica y persistencia existentes se reutilizan, no se duplican;
- el guardado global permanece centralizado;
- cualquier nueva familia de ajustes debe agregarse primero como acceso del hub.

Secciones actuales:

- Sede;
- Domicilios;
- Repartidores;
- Clientes;
- Pagos.

No volver a apilar todas estas secciones simultáneamente en la vista principal.


### Distribución interna del Hub

Las secciones del Hub de Configuración deben aprovechar el ancho disponible según el tipo de contenido:

- **Sede:** buscador compartido de Google Places + ubicación actual a la izquierda; mapa de origen y pin editable a la derecha. No mostrar un campo de enlace de Google Maps ni un botón separado de validación manual.
- **Domicilios:** zonas y tarifas a la izquierda; mapa de cobertura a la derecha.
- **Repartidores:** operación y compensación en paneles paralelos.
- **Clientes:** controles sensibles en cards compactas, sin espacio vertical innecesario.
- **Pagos:** medios fijos como cards analíticas; solo activar/desactivar.

En desktop, los mapas pueden ser `sticky` dentro de su columna para mantener contexto mientras se editan datos.


### Búsqueda compartida de direcciones

La búsqueda de direcciones con Google Places usa el componente compartido `GoogleAddressSearch`.

Se reutiliza en:

- dirección del cliente;
- configuración de la sede.

La carga del SDK del navegador se centraliza en `src/lib/googleMapsClient.ts`.

No crear un segundo autocompletado propio para nuevas superficies. Cuando el usuario selecciona una dirección de Google deben conservarse `formattedAddress`, `placeId`, `latitude` y `longitude`. El reverse geocoding se usa únicamente al mover un pin o partir de coordenadas.


### Personalización dentro de Configuración

`/personalizacion` es un submódulo de `/configuracion`, no un módulo independiente del menú lateral.

Reglas:

- Configuración debe permanecer marcada como activa mientras se navega en Personalización.
- La vista debe ofrecer breadcrumb y acción explícita para volver a Configuración.
- Si existen cambios sin guardar, se debe advertir antes de abandonar la página.
- El guardado usa la acción compacta del header estándar.
- Las acciones que restablecen una pieza visual deben requerir confirmación y describirse como **Usar imagen predeterminada**, no como eliminación destructiva.
- La API administrativa de Personalización es exclusiva para rol `ADMIN`.

Piezas configurables actuales:

- Home móvil: 1080 × 2160 px.
- Home PC: 1920 × 1080 px.
- Portada del menú: 1920 × 1080 px (16:9).

No agregar controles de personalización que no tengan un consumidor real en la experiencia pública. El antiguo `brand.logoUrl` fue retirado porque ninguna superficie lo renderizaba.


## Navegación interna en teléfono

La experiencia móvil de colaboradores debe priorizar **supervisión**, no replicar todo el menú administrativo de escritorio.

Aplica únicamente en teléfono, por debajo del breakpoint `sm` (menos de 640 px). Tablet y escritorio conservan la navegación completa según ancho y rol.

Reglas vigentes:

- la hamburguesa se ubica en el costado izquierdo del header;
- el acceso principal del teléfono lleva a la primera superficie de supervisión disponible para el rol;
- el drawer móvil muestra únicamente los módulos de supervisión que el rol realmente puede abrir;
- para `ADMIN`, el orden canónico es:
  1. Pedidos;
  2. Cocina;
  3. Caja;
  4. Usuarios y Roles;
  5. Configuración;
- no mostrar en el drawer de teléfono POS, Clientes, Menú administrativo, Cupones, Turnos, Club, Notificaciones o Métricas aunque sigan existiendo y sean accesibles desde tablet/escritorio;
- esta simplificación es de navegación, **no cambia permisos de backend ni elimina rutas**;
- el estado **Abierta/Cerrada** de la tienda no debe flotar sobre el contenido interno en teléfono: se presenta dentro del drawer lateral;
- el detalle de horarios y el control del aviso sonoro continúan disponibles desde ese estado;
- tablet (`sm` a `lg`) conserva el menú completo y el comportamiento anterior del estado de tienda;
- la experiencia pública del cliente no comparte este patrón y no debe modificarse al ajustar la navegación interna.

Implementación principal:

- `src/components/AppShell.tsx`;
- `src/components/StaffStoreStatus.tsx`.

No ampliar el menú móvil por comodidad. Si una tarea administrativa no es de supervisión rápida, debe permanecer en tablet/escritorio salvo una decisión explícita de producto.
