# Sistema visual y tipográfico de Alentó

Última actualización: 2026-09-29.

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
