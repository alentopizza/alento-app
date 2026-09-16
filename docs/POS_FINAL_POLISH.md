# Pulido visual final del POS

Última actualización: 2026-09-16.

Este documento registra los ajustes visuales de cierre aplicados al punto de venta sin modificar la lógica operativa ni la integridad estructurada de pedidos.

## Tipografía

El POS usa una pila tipográfica de sistema más limpia y ligera:

```css
ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif
```

El objetivo es reducir la apariencia pesada/rústica del módulo sin introducir dependencias externas de fuentes.

## Títulos del panel derecho

Los encabezados operativos quedan así:

- `SELECCIONE TIPO DE PEDIDO`
- `INFORMACIÓN CLIENTE`

Reglas visuales:

- sin asteriscos;
- centrados;
- color rojo Alentó;
- peso moderado (`700`) en lugar de negro pesado;
- tamaño ligeramente superior al texto auxiliar;
- sin mostrar pasos numerados ni etiquetas `OBLIGATORIO / OPCIONAL`.

La obligatoriedad del cliente sigue siendo funcional:

- Domicilio: cliente obligatorio;
- Recoger: cliente obligatorio;
- Local: cliente opcional.

## Selector de modalidad

Las opciones visibles siguen siendo:

- `DOMICILIO`
- `RECOGER`
- `LOCAL`

Se mantienen sin emojis y en mayúsculas, pero con un peso tipográfico más fino para acompañar el nuevo estilo general.

## Alcance

Estos cambios son exclusivamente visuales y están encapsulados en `src/app/pos-polish.css` para no afectar los módulos administrativos (`/menu`, `/pedidos`, `/clientes`, `/configuracion`).

No requieren cambios de Prisma ni `db push`.
