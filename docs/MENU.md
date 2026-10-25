# Menú administrativo

Estado: **CERRADO PARA LA ETAPA OPERATIVA ACTUAL**

Ruta: `/interno/menu`

Este documento es la referencia canónica del catálogo administrativo de Alentó App. Debe permitir que una persona o una IA reconstruya el módulo sin depender del historial de conversaciones.

## Objetivo

Menú administra la estructura comercial que consume el Punto de venta:

- categorías;
- productos;
- orden visual;
- imágenes;
- precios base;
- estados de disponibilidad;
- visibilidad en POS;
- destacados;
- combos configurables.

El módulo no crea pedidos. Su responsabilidad es definir y mantener el catálogo que luego consume `GET /api/catalog`.

## Arquitectura general

Flujo principal:

```text
/interno/menu
→ GET /api/menu-admin
→ Category + Product + reglas de combo + tamaños
→ administración visual
→ PATCH/POST/DELETE /api/menu-admin
→ PostgreSQL
→ GET /api/catalog
→ POS
```

La administración y el catálogo del POS comparten las mismas entidades de Prisma. No mantener un catálogo paralelo.

## Modelos principales

### Category

Campos relevantes:

- `id`;
- `name`;
- `slug`;
- `active`;
- `visibleInPos`;
- `sortOrder`;
- relación `products`.

Regla crítica:

**el nombre visible y el slug interno tienen responsabilidades distintas.**

Renombrar una categoría actualiza `Category.name`, pero **no cambia `Category.slug`**.

Esto permite, por ejemplo, cambiar el nombre visible de una categoría base sin romper reglas internas que todavía dependen de su slug.

Los productos no almacenan una copia del nombre de la categoría. Están vinculados mediante `Product.categoryId`, por lo que automáticamente heredan el nuevo nombre visible de la categoría en las interfaces que consultan esa relación.

### Product

Campos relevantes:

- `id`;
- `categoryId`;
- `name`;
- `description`;
- `imageUrl`;
- `imageUrl2`;
- `type`;
- `basePrice`;
- `comboDiscount`;
- `active`;
- `visibleInPos`;
- `featured`;
- `sortOrder`.

### ProductImage

Las imágenes cargadas desde Alentó se almacenan en `ProductImage`:

- `id`;
- `productId`;
- `slot` (`MAIN` o `SECONDARY`);
- `filename`;
- `contentType`;
- `data` (`Bytes`);
- `sizeBytes`;
- `createdAt`.

`Product.storedImages` mantiene la relación y usa `onDelete: Cascade` para no dejar binarios huérfanos cuando un producto se elimina.

`imageUrl` e `imageUrl2` siguen siendo los campos consumidos por el catálogo/POS; cuando la imagen es interna apuntan a `/api/product-images/[id]`.

## Tipos de producto vigentes

El enum de Prisma actual es:

```text
STANDARD
PIZZA_SINGLE
PIZZA_TWO_FLAVORS
COMBO
MODIFIER
INTERNAL
```

Estos tipos son **internos y estructurales**. No confundirlos con categorías visibles.

Ejemplos:

- una categoría personalizada nueva no crea un nuevo `ProductType`;
- sus productos nuevos se crean actualmente como `STANDARD`;
- la categoría `pizzas` crea `PIZZA_SINGLE`;
- `ingredientes` crea `MODIFIER`;
- los combos usan `COMBO`;
- la pizza especial de dos sabores usa `PIZZA_TWO_FLAVORS`.

## Categorías base

Los slugs base protegidos son:

- `destacados`;
- `pizzas`;
- `antojos`;
- `bebidas`;
- `combos`;
- `ingredientes`.

Estas categorías:

- pueden renombrarse;
- pueden reorganizarse;
- conservan su slug;
- **no pueden eliminarse** desde el administrador.

La protección existe porque otras reglas del sistema usan esos slugs como identificadores funcionales.

## Categorías personalizadas

Desde Menú se pueden crear categorías nuevas.

Flujo:

```text
+ Categoría
→ nombre
→ POST /api/menu-admin { action: "createCategory" }
→ slug generado automáticamente
→ active = true
→ visibleInPos = true
→ sortOrder al final
```

El slug se genera normalizando el nombre y se hace único agregando sufijos cuando sea necesario.

Ejemplo:

```text
Postres
→ postres

Postres (si postres ya existe)
→ postres-2
```

Una categoría personalizada puede eliminarse únicamente cuando tiene **0 productos vinculados**.

El backend vuelve a validar esta condición; no confiar solo en el estado visual del botón.

## Orden de categorías

Las categorías son arrastrables desde la franja horizontal superior.

El orden persistente vive en:

`Category.sortOrder`

Endpoint lógico:

```text
POST /api/menu-admin
action = reorderCategories
categoryIds = [...]
```

El backend exige que la lista contenga exactamente las categorías administrables actuales antes de escribir el nuevo orden.

`GET /api/catalog` también ordena por `Category.sortOrder`, por lo que el orden configurado en Menú se refleja en el POS.

No volver a introducir un mapa fijo de prioridades para Pizzas/Antojos/Bebidas/etc.; el orden real debe venir de base de datos.

## Orden de productos

Dentro de una categoría los productos pueden reordenarse con drag & drop.

Para categorías normales:

`Product.sortOrder`

se actualiza en transacción.

La búsqueda debe estar vacía para permitir reordenamiento, porque ordenar una lista filtrada podría producir un orden incompleto o ambiguo.

## Destacados

`Destacados` no contiene copias de productos.

Un producto aparece allí cuando:

`Product.featured = true`

El orden de Destacados es independiente del orden del producto dentro de su categoría original.

Se guarda en:

```text
AppSetting.key = "menu.featuredProductOrder"
AppSetting.value = [productId, productId, ...]
```

Esto permite mover un combo o una pizza dentro de Destacados sin alterar su posición en Combos o Pizzas.

El POS respeta este mismo orden.

## Tarjetas de producto

La tarjeta visual canónica es la misma del menú público del cliente y se comparte entre:

- `/menu` público;
- POS interno;
- Menú administrativo.

La fuente visual única vive en `src/app/globals.css` mediante las clases `.alento-product-card*`.

Reglas:

- tarjeta oscura;
- imagen principal 1:1 a sangre;
- `object-cover`;
- nombre sobre bloque negro;
- precio / `Desde` / `Ahorra` como dato principal;
- acción circular roja `+`;
- hover y proporciones compartidas.

El Menú administrativo puede superponer badges de estado y el control `⋮⋮` porque son funciones operativas propias, pero no debe crear otra estructura visual de tarjeta.

La tarjeta completa abre el administrador del producto.

No volver a llenar las tarjetas con botones de Editar/Desactivar/Ocultar/Eliminar. Esas acciones viven dentro del popup del producto.

## Buscador

El buscador filtra productos por:

- nombre;
- descripción.

Mientras existe búsqueda activa no se permite reordenar productos.

## Administrar producto

Al hacer clic sobre una tarjeta se abre el popup de control.

Contiene:

- resumen visual;
- imagen;
- precio;
- estado;
- acciones.

### Switches rápidos

Tres estados se modifican sin cerrar el popup:

- `active`;
- `visibleInPos`;
- `featured`.

La UI actualiza el estado local y el backend persiste mediante `PATCH /api/menu-admin`.

Para productos `MODIFIER`, las opciones que no aplican se deshabilitan en UI.

### Significado de estados

`active`:
- controla si el producto está habilitado operativamente.

`visibleInPos`:
- controla si aparece como producto navegable en el catálogo del POS.

`featured`:
- controla si aparece en la categoría virtual Destacados.

Estas propiedades no deben fusionarse. Un producto puede estar activo y no visible en POS, o activo/visible y no destacado.

## Editar información

El editor permite cambiar:

- nombre;
- descripción;
- precio base / valor del sabor;
- imagen principal;
- imagen secundaria.

### Imágenes oficiales del producto

Las imágenes ya no se administran pegando URLs desde la interfaz.

Flujo vigente:

1. si el producto tiene una URL histórica externa, se sigue mostrando sin migración forzada;
2. ADMIN selecciona una imagen JPG, PNG o WebP desde el dispositivo;
3. `POST /api/product-images` guarda el archivo binario en PostgreSQL;
4. se crea una ruta interna `/api/product-images/[id]`;
5. `Product.imageUrl` o `Product.imageUrl2` pasa inmediatamente a esa ruta interna;
6. la imagen cargada se convierte en la fuente oficial del producto;
7. al reemplazar otra imagen interna del mismo slot se elimina la anterior;
8. al eliminar un producto, sus imágenes internas se eliminan por relación `onDelete: Cascade`.

Límite actual: **8 MB** por imagen.

Formatos admitidos:

- JPG/JPEG;
- PNG;
- WebP.

La carga/reemplazo en productos existentes se guarda inmediatamente y no depende del botón **Guardar cambios** del formulario. Ese botón sigue aplicando nombre, descripción, precio y demás propiedades.

Para productos nuevos, los archivos pueden seleccionarse antes de crear. El producto se crea primero y las imágenes seleccionadas se cargan automáticamente después de obtener su ID.

Las URLs históricas siguen siendo compatibles únicamente para no romper imágenes actuales. No volver a exponer campos de URL como flujo normal de administración.

El editor muestra vista previa de las imágenes y del precio.

Los estados Activo/Visible/Destacado se administran desde el popup principal, no desde el formulario de información.

## Crear productos

En categorías normales se permite crear producto.

Reglas actuales de tipo:

```text
pizzas       → PIZZA_SINGLE
antojos      → STANDARD
bebidas      → STANDARD
ingredientes → MODIFIER
otra categoría personalizada → STANDARD
```

No se crean productos directamente desde:

- `destacados`;
- `combos`.

Destacados deriva de `featured`.

Combos utiliza su constructor especializado.

## Precios mostrados

### PIZZA_SINGLE

El valor guardado en `basePrice` representa el valor del sabor.

En Menú se muestra:

```text
precio mínimo del tamaño
+ valor del sabor
```

Por eso la tarjeta puede mostrar `Desde $...`.

### PIZZA_TWO_FLAVORS

La tarjeta muestra:

`Precio según sabores`

porque el valor final depende de configuración.

### STANDARD / MODIFIER

Usan `basePrice`.

### COMBO

El administrador calcula rango regular a partir de:

- reglas de pizza;
- tamaños permitidos;
- sabores permitidos;
- grupos;
- opciones;
- cantidades.

Después descuenta `comboDiscount`.

Puede existir:

- `comboRegularMin`;
- `comboRegularMax`;
- `comboFinalMin`;
- `comboFinalMax`.

## Constructor de combos

Los combos utilizan:

- `Product.type = COMBO`;
- `ComboPizzaRule`;
- `ComboPizzaSizeOption`;
- `ComboPizzaFlavorOption`;
- `ComboGroup`;
- `ComboOption`.

El constructor permite definir conceptualmente:

- cantidad de pizzas;
- tamaños permitidos;
- sabores permitidos;
- cantidad de antojos;
- productos permitidos;
- cantidad de bebidas;
- bebidas permitidas;
- descuento fijo del combo;
- imágenes y descripción.

La categoría `combos` se garantiza mediante `ensureCombosCategory()`.

Los productos `COMBO` que hayan quedado asociados a otra categoría se corrigen hacia la categoría `combos`.

## Eliminar productos

La eliminación es física, pero está protegida.

Un producto **no puede eliminarse** cuando:

- tiene historial en `OrderItem`;
- es opción de un combo;
- es sabor permitido de un combo;
- otra restricción referencial impide el borrado.

Cuando tiene historial debe desactivarse u ocultarse en lugar de eliminarse.

Esta regla preserva integridad histórica.

## Relación con POS

El POS consume:

`GET /api/catalog`

Ese endpoint entrega solo el catálogo operativo y respeta:

- categoría;
- nombre editado;
- `Category.sortOrder`;
- productos activos;
- `visibleInPos`;
- `Product.sortOrder`;
- orden independiente de Destacados;
- reglas de combo;
- tamaños;
- bordes;
- modificadores.

Menú es por tanto la fuente administrativa; `/api/catalog` es la proyección operativa.

## Archivos principales

- `src/app/interno/menu/page.tsx`
- `src/app/api/menu-admin/route.ts`
- `src/app/api/catalog/route.ts`
- `src/components/AppShell.tsx`
- `prisma/schema.prisma`

Modelos relacionados:

- `Category`
- `Product`
- `PizzaSize`
- `PizzaCrust`
- `PizzaCrustPrice`
- `ComboPizzaRule`
- `ComboPizzaSizeOption`
- `ComboPizzaFlavorOption`
- `ComboGroup`
- `ComboOption`
- `AppSetting`

## Reglas de no regresión

- no acoplar el nombre visible de una categoría a su slug;
- no cambiar el slug al renombrar;
- no permitir eliminar categorías base;
- no permitir eliminar categorías personalizadas con productos;
- no volver a forzar un orden fijo de categorías en frontend;
- no hacer que Destacados altere el `sortOrder` de la categoría original;
- no duplicar productos para implementar Destacados;
- no borrar productos con historial;
- no confiar en tarjetas del frontend para validar dependencias;
- no crear combos como productos estándar;
- no mezclar administración de estados con el formulario de edición de información.

## Mejoras futuras de Menú

Estas mejoras **no forman parte del cierre actual**. Deben tratarse como una nueva fase cuando se aprueben.

### 1. Administración de tipos de producto

Hoy `ProductType` es un enum fijo de Prisma y parte de la lógica vive en código.

Mejora futura deseada:

- definir tipos de producto desde una capa administrativa o de configuración;
- desacoplar comportamientos de slugs específicos;
- declarar por tipo si:
  - requiere Cocina;
  - usa configurador;
  - usa tamaño;
  - usa borde;
  - permite sabores;
  - permite modificadores;
  - tiene precio fijo o calculado;
  - puede ser componente de combo;
  - aparece como producto independiente;
- evitar tener que modificar TypeScript/Prisma para cada nueva familia comercial.

Antes de implementarlo se debe diseñar una estrategia de migración desde el enum actual, porque `ProductType` participa en POS, Cocina, normalización de pedidos y combos.

### 2. Modificadores

Hoy los ingredientes extra son productos `MODIFIER` globales consumidos principalmente por pizzas.

Mejora futura deseada:

- grupos de modificadores por producto o categoría;
- modificadores obligatorios u opcionales;
- mínimos/máximos;
- precio por modificador;
- modificadores gratuitos hasta cierto límite;
- disponibilidad por tamaño;
- reglas de incompatibilidad;
- orden visual;
- activación/desactivación;
- alcance por producto/categoría/tipo;
- soporte futuro para modificadores por mitad en pizzas de dos sabores.

Regla actual importante:

**las pizzas de dos sabores no permiten ingredientes extra**, porque actualmente el modificador se aplicaría a la pizza completa y sería ambiguo saber a qué mitad corresponde.

No reactivar extras en `PIZZA_TWO_FLAVORS` hasta que exista un modelo estructurado de alcance del modificador.

## Cierre del módulo

Menú se considera **cerrado para la etapa operativa actual**.

Puede recibir:

- correcciones de bugs;
- mejoras pequeñas de legibilidad;
- ajustes de datos.

No debe reabrirse como rediseño estructural salvo solicitud explícita.

Las mejoras de **tipos de producto** y **modificadores** quedan registradas como backlog futuro y no son requisito para operar el catálogo actual.
