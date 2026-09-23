# Checkout público + Google Maps Platform

Estado: **IMPLEMENTACIÓN EN CURSO — SEDE, PLACES Y ROUTES CONECTADOS**

Este documento define cómo Alentó App resolverá dirección, geolocalización, cobertura y tarifa de domicilio en el checkout público.

Regla central: **el navegador nunca decide la distancia ni la tarifa oficial del domicilio**. El cliente selecciona o comparte una ubicación; el servidor valida esa ubicación, calcula la ruta y aplica las bandas configuradas en Alentó.

## Objetivo

Flujo objetivo:

1. Carrito → Continuar pedido.
2. Elegir Domicilio, Recoger o Local.
3. Para Domicilio: buscar dirección o usar ubicación actual.
4. Confirmar el punto de entrega en mapa.
5. Calcular ruta real desde Alentó.
6. Aplicar cobertura/tarifa server-side.
7. Continuar a cliente, pago, resumen y creación del pedido WEB.

## Google Maps Platform

Servicios previstos:

- Maps JavaScript API: mapa y pin de confirmación.
- Places API (New): autocompletado de direcciones.
- Geocoding API: convertir coordenadas GPS en una dirección legible.
- Routes API: calcular distancia real de ruta desde Alentó hasta el cliente.

No usar distancia en línea recta para cobrar domicilio.

## Variables de entorno

Clave pública del navegador:

    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""

Uso: Maps JavaScript API + Places. Debe restringirse por HTTP referrer a alentopizza.com.

Clave privada del servidor:

    GOOGLE_MAPS_SERVER_API_KEY=""

Uso: Routes/Geocoding. Nunca debe enviarse al navegador ni guardarse en Git.

## Ubicación oficial de Alentó

La sede debe tener una ubicación canónica en configuración del sistema:

- nombre de sede;
- dirección;
- latitude;
- longitude;
- Google Place ID cuando esté disponible.

No escribir esas coordenadas de forma rígida en el componente del carrito.

## Flujo de dirección

### Buscar dirección

- campo con Google Places Autocomplete;
- priorizar Bogotá/zona de servicio;
- exigir selección de una dirección válida;
- conservar placeId, dirección formateada y coordenadas.

### Usar mi ubicación

Solo solicitar geolocalización cuando el cliente toque **Usar mi ubicación**.

Si acepta:

1. obtener latitude/longitude;
2. resolver dirección legible;
3. mostrar pin;
4. permitir confirmación/corrección.

Si rechaza el permiso, el flujo de búsqueda de dirección debe seguir funcionando.

### Confirmar punto

La experiencia de domicilio usa un layout compacto orientado a móvil:

- el checkout inicia por defecto en **Recoger en tienda**;
- al elegir **Domicilio**, solo se precarga una dirección si pertenece al cliente autenticado y está guardada en su perfil;
- la consulta de dirección guardada ocurre en segundo plano y nunca reemplaza ni bloquea el campo manual de Google Places;
- si el cliente no está autenticado, no hay dirección guardada o la consulta tarda/falla, el buscador sigue disponible inmediatamente;
- una dirección temporal de un checkout anterior no se reutiliza automáticamente;
- antes de seleccionar dirección se muestra el buscador y el acceso **Mi ubicación**;
- al cambiar desde **Recoger en tienda** hacia **Domicilio**, el autocompletado se inicializa únicamente cuando su contenedor editable ya está renderizado;
- no se muestra ningún mapa hasta que exista un destino validado, evitando mapas de origen/fallback que puedan confundir al cliente;
- cuando Google valida una dirección, el buscador se colapsa automáticamente;
- la dirección confirmada queda en una tarjeta compacta con acción de lápiz para editarla;
- el mapa pasa a ser el elemento visual principal en formato 3:4 y se inicializa únicamente cuando su contenedor ya está montado;
- la ruta Alentó → cliente se dibuja sobre el mapa;
- Ruta, Domicilio y Tiempo se integran como una cabecera flotante dentro de la parte superior del mapa;
- al entrar en modo edición se bloquea la confirmación hasta validar de nuevo la dirección.

Más adelante este bloque se complementará con barrio, apartamento/casa/local y nota de entrega antes de crear el pedido.

## Cotización segura

El contrato público de domicilio no debe recibir distanceMeters como verdad.

El backend debe:

1. validar placeId/coordenadas;
2. tomar la ubicación oficial de Alentó;
3. consultar Routes API;
4. obtener distanceMeters;
5. buscar la banda activa en pos_settings.deliveryBands;
6. devolver covered, distanceMeters y deliveryFee.

El endpoint actual /api/delivery/quote podrá evolucionar para recibir ubicación en vez de distancia calculada por el navegador.

## Datos de dirección

Cuando comience la implementación se ampliará CustomerAddress para conservar:

- placeId;
- formattedAddress;
- latitude;
- longitude;
- postalCode opcional;
- locationSource (GOOGLE_PLACE / DEVICE_GPS / MANUAL_CONFIRMED).

Los campos actuales address, neighborhood, city y notes se mantienen.

**Este documento no modifica aún Prisma.** El cambio de schema se hará en implementación y requerirá `npx prisma db push`.

## Seguridad

- recalcular ruta y tarifa al crear el pedido;
- no aceptar deliveryFee ni distanceMeters enviados por el navegador;
- restringir las dos API keys;
- validar coordenadas en servidor;
- aplicar rate limiting razonable;
- no pedir GPS sin acción explícita del usuario.

## Fases de implementación

### Fase A — Google Cloud

1. Crear/seleccionar proyecto.
2. Habilitar facturación.
3. Habilitar Maps JavaScript API.
4. Habilitar Places API (New).
5. Habilitar Geocoding API.
6. Habilitar Routes API.
7. Crear clave pública restringida.
8. Crear clave privada de servidor.
9. Agregar ambas variables en EasyPanel.

### Fase B — Configuración de sede

Guardar dirección, coordenadas y Place ID oficiales de Alentó en configuración.

### Fase C — Persistencia de direcciones

Ampliar CustomerAddress, ejecutar prisma db push y mantener compatibilidad con direcciones históricas.

### Fase D — Selector de dirección

Autocomplete, botón Usar mi ubicación, reverse geocoding, mapa/pin y guardado de dirección.

### Fase E — Cotización

Routes API → distanceMeters → bandas actuales → cobertura/tarifa.

### Fase F — Checkout

Estado: **IMPLEMENTADA EN V1**.

Flujo actual:

Modalidad → dirección/cobertura → datos del cliente → pago → creación `Order.source=WEB` → seguimiento.

Reglas actuales:

- login opcional;
- invitado permitido;
- nombre y teléfono obligatorios;
- sesión de cliente autocompleta datos;
- recuperación de datos existentes requiere OTP por WhatsApp;
- no se revelan datos privados por búsqueda pública de teléfono;
- productos se vuelven a normalizar server-side;
- domicilio se vuelve a calcular server-side;
- pago inicial se crea como `PENDING`;
- se usa el mismo consecutivo global que POS.

## Criterios de aceptación

- dirección Google queda geolocalizada;
- GPS requiere consentimiento explícito;
- rechazar GPS no bloquea checkout;
- mapa confirma el punto;
- Routes calcula la ruta real;
- Alentó decide la tarifa con sus bandas actuales;
- fuera de cobertura no puede finalizar Domicilio;
- manipular requests del navegador no reduce tarifa;
- direcciones confirmadas pueden reutilizarse;
- PICKUP no consulta Routes ni agrega domicilio;
- funciona en móvil, PWA, tablet y escritorio.

## Avance implementado

- Fase A: Google Cloud y claves configuradas por operación.
- Fase B: sede validada con Google Geocoding y persistida en `pos_settings`.
- Fase D: checkout público ya puede buscar direcciones con Place Autocomplete (New) o solicitar GPS explícitamente.
- El checkout inicia en Recoger en tienda, no reutiliza direcciones temporales de compras anteriores y solo precarga la dirección guardada de un cliente autenticado.
- El checkout colapsa la dirección confirmada, permite editarla con acción de lápiz y usa un mapa 3:4 como elemento principal, con Ruta / Domicilio / Tiempo integrados en la parte superior.
- El Map ID `Alento Delivery Map` usa el estilo cloud `Alento Delivery Light`.
- Fase E: `POST /api/delivery/quote` calcula ruta real con Routes API, expone la geometría de la ruta y aplica las bandas activas del sistema.
- El mapa dibuja la ruta Alentó → cliente y resume Ruta / Domicilio / Tiempo en una sola fila.
- El carrito ya habilita **Continuar pedido**, conserva la modalidad/domicilio seleccionado y muestra domicilio + total provisional.

## Checkout como flujo de página

El checkout público ya no debe crecer como una cadena de modales.

Flujo vigente dentro de `/cart`:

`Carrito → Entrega → Datos y pago → Confirmación`

Reglas:

- Entrega se renderiza como contenido de página, no como overlay;
- Datos y pago también usa modo de página completa;
- el header público permanece visible;
- cada paso conserva navegación de regreso al anterior;
- mapa y selector de direcciones aprovechan el ancho disponible;
- no reintroducir contenedores centrados de 680px para este flujo salvo una necesidad puntual.

## Selección de direcciones guardadas

Cuando un cliente autenticado tiene varias `CustomerAddress`:

- el checkout carga todas las direcciones;
- la dirección `isDefault=true` se selecciona inicialmente;
- la principal no es obligatoria para ese pedido;
- el cliente puede cambiar entre Casa, Trabajo u otra dirección guardada;
- al seleccionar otra dirección se resuelve con Google, se recalculan ruta, cobertura, tarifa y tiempo, y se actualiza el mapa;
- **+ Nueva** abre el buscador de Google para una ubicación distinta;
- el botón de editar sigue permitiendo reemplazar la selección actual con una dirección buscada en Google.

No volver a implementar el checkout usando exclusivamente la primera dirección guardada.

## Próximo paso

Validar en producción el flujo completo desde carrito hasta creación `WEB`, incluyendo invitado, recuperación por WhatsApp, efectivo y seguimiento. Después completar Fase C con persistencia enriquecida de `CustomerAddress` y mejorar selección/edición de direcciones.

No pegar las claves en chats, commits ni capturas públicas.
