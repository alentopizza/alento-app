# SEO local y orgánico de Alentó Pizza

Última actualización: 2026-10-16.

Este documento es la referencia operativa del SEO público de Alentó Pizza.

## Objetivo

Aumentar la visibilidad de `alentopizza.com` para búsquedas con intención local y transaccional, especialmente:

- Alentó Pizza;
- pizza en Kennedy;
- pizzería en Kennedy;
- pizza a domicilio Kennedy;
- pizza Nuevo Kennedy;
- domicilios de pizza en Bogotá;
- pizzas, combos, antojos y productos concretos del catálogo.

No existe una configuración que garantice la posición #1. El SEO local depende de relevancia, distancia y prominencia, además de competencia, reseñas, enlaces y comportamiento del sitio. El código cubre la parte técnica y de contenido que sí controlamos.

---

## Arquitectura indexable

Páginas públicas principales:

- `/`
- `/menu`
- `/club`
- `/ubicacion`
- `/domicilios`

Páginas de categoría:

- `/menu/categoria/<slug>`

Páginas de producto:

- `/menu/<id>-<slug-del-producto>`

Ejemplos:

- `/menu/categoria/pizzas`
- `/menu/5-fiesta-pepperoni`

Las páginas administrativas, carrito, seguimiento, repartidores, APIs y demás superficies privadas llevan `X-Robots-Tag: noindex, nofollow` y están fuera del sitemap.

---

## Metadatos

Cada página pública importante debe tener:

- título único;
- descripción única;
- canonical;
- Open Graph;
- Twitter Card;
- imagen social;
- idioma `es-CO`;
- robots index/follow.

Evitar repetir títulos y evitar keyword stuffing.

Las palabras clave se usan como soporte semántico, no como sustituto de contenido real.

---

## Datos estructurados

Implementados:

- `WebSite`;
- `Restaurant`;
- `PizzaPlace`;
- `Product`;
- `Offer`;
- `BreadcrumbList`;
- `ItemList`;
- `Service`;
- `OpeningHoursSpecification`;
- `GeoCoordinates` cuando la sede tiene coordenadas guardadas.

Los precios de productos SEO deben coincidir con lo que ve el cliente.

No inventar reseñas, ratings, premios ni disponibilidad.

---

## Sitemap y robots

Sitemap:

`https://alentopizza.com/sitemap.xml`

Incluye:

- inicio;
- menú;
- Club;
- ubicación;
- domicilios;
- categorías públicas;
- productos públicos activos.

Robots:

`https://alentopizza.com/robots.txt`

Las URLs privadas se excluyen y además reciben `noindex`.

---

## SEO local

La página `/ubicacion` usa los datos reales guardados en Configuración:

- dirección;
- coordenadas, si existen;
- horarios activos.

La página `/domicilios` usa las bandas activas de cobertura y tarifas.

Mantener consistencia NAP:

- Nombre: Alentó Pizza
- Dirección: la misma usada en Google Business Profile y Configuración
- Teléfono: 324 333 4009

No usar variantes distintas de nombre, teléfono o dirección en directorios externos.

---

## Google Business Profile

Para competir en búsquedas locales, mantener el Perfil de Negocio:

1. verificado;
2. categoría principal correcta, por ejemplo Pizzería/Pizza restaurant según lo disponible;
3. dirección exacta;
4. horario habitual y horarios especiales;
5. teléfono y web;
6. enlace directo al menú;
7. fotos reales de pizzas, local y equipo;
8. publicaciones frecuentes;
9. respuestas a reseñas;
10. flujo constante de reseñas auténticas.

Las reseñas no deben comprarse ni incentivarse de forma engañosa.

---

## Google Search Console

Después de desplegar:

1. crear/verificar propiedad para `https://alentopizza.com`;
2. añadir el token a `GOOGLE_SITE_VERIFICATION`;
3. enviar `https://alentopizza.com/sitemap.xml`;
4. inspeccionar:
   - `/`
   - `/menu`
   - `/ubicacion`
   - `/domicilios`
   - una categoría;
   - dos o tres productos;
5. solicitar indexación inicial;
6. revisar semanalmente:
   - consultas;
   - impresiones;
   - CTR;
   - posición media;
   - páginas indexadas;
   - errores de rastreo.

No perseguir posiciones aisladas; medir clics y pedidos orgánicos.

---

## Bing Webmaster Tools

Opcional pero recomendado:

- verificar con `BING_SITE_VERIFICATION`;
- enviar el mismo sitemap;
- comprobar indexación.

---

## Contenido y enlaces

Prioridades:

1. productos con URLs propias;
2. categorías con contenido útil;
3. ubicación y domicilios;
4. nombres de producto claros;
5. descripciones reales y específicas;
6. enlaces internos con texto descriptivo.

Evitar páginas casi vacías o creadas solo para repetir palabras clave.

---

## Medición

Google Analytics 4 ya está integrado desde `/metricas`.

Cruzar SEO con:

- `page_view`;
- `view_item`;
- `add_to_cart`;
- `begin_checkout`;
- `purchase`.

En Search Console, observar búsquedas locales y CTR. En GA4, observar si esas visitas terminan en carrito/pedido.

---

## Próximas oportunidades

Cuando exista suficiente tráfico:

- páginas editoriales para búsquedas reales detectadas en Search Console;
- optimización de títulos según CTR;
- contenidos locales útiles, no genéricos;
- adquisición de enlaces y menciones locales legítimas;
- seguimiento de competidores y keywords con una herramienta SEO;
- calendario de Google Business Profile y reseñas.

Nunca crear contenido masivo de baja calidad ni páginas de barrios donde Alentó no tenga cobertura real.

---

## Checklist después de cada cambio SEO

- canonical correcto;
- title y description únicos;
- página accesible sin login;
- noindex solo donde corresponde;
- imagen social carga;
- JSON-LD válido;
- enlaces internos rastreables;
- sitemap actualizado;
- sin contenido duplicado;
- precio y datos del negocio coinciden con producción.
