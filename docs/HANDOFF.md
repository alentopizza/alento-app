# Handoff y continuidad del proyecto

Este documento existe para que una nueva persona, desarrollador o IA pueda retomar Alentó App sin depender del historial de una conversación anterior.

## Lectura obligatoria al retomar el proyecto

Antes de modificar código, leer en este orden:

1. `README.md`
2. `docs/CURRENT_STATE.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DEPLOYMENT.md`
5. `prisma/schema.prisma`
6. Los archivos del módulo que se vaya a modificar.

Después, revisar los commits recientes de `main` para entender los últimos cambios.

## Regla obligatoria de documentación

Todo cambio funcional o estructural importante debe quedar documentado en el mismo bloque de trabajo.

Como mínimo:

- actualizar `docs/CURRENT_STATE.md` cuando cambie qué está implementado, el flujo actual o el próximo paso;
- actualizar `docs/ARCHITECTURE.md` cuando cambie una regla comercial, modelo de datos, integración, API, responsabilidad de módulo o decisión estructural;
- actualizar `docs/DEPLOYMENT.md` cuando cambie Prisma, EasyPanel, variables de entorno, despliegue o procedimiento operativo;
- actualizar `README.md` cuando cambie de forma relevante el objetivo, roadmap o mapa de documentación;
- documentar cualquier comando manual necesario después del despliegue, especialmente `npx prisma db push`.

No considerar una funcionalidad importante como terminada hasta haber actualizado la documentación relacionada.

## Qué debe quedar claro después de cada cambio

La documentación debe permitir responder sin revisar conversaciones antiguas:

- qué hace actualmente el sistema;
- qué módulos existen;
- cuál es el flujo operativo del POS;
- qué reglas comerciales están activas;
- qué datos se guardan en PostgreSQL;
- qué APIs existen y para qué sirven;
- qué partes están terminadas y cuáles son temporales;
- qué requiere pasos manuales de despliegue;
- cuál es el siguiente bloque de desarrollo aprobado.

## Estado conceptual que debe respetarse

Alentó App es la fuente operativa principal. Chatwoot debe ser un canal de atención y no un segundo motor de pedidos.

El flujo objetivo compartido por POS, Chatwoot y la futura app de clientes debe reutilizar las mismas reglas de:

- catálogo;
- precios;
- promociones y elegibilidad de descuentos;
- cupones;
- cobertura y domicilio;
- clientes;
- pedidos;
- pagos.

## Reglas actuales especialmente importantes

- Domicilio y Recoger en tienda requieren cliente.
- Local permite cliente opcional.
- El domicilio usa por ahora una tarifa/zona manual configurada desde `/configuracion`.
- Google Maps queda como automatización futura y no como dependencia operativa actual.
- Los cupones y descuentos solo se aplican sobre productos elegibles.
- Combos y productos promocionales/no acumulables no reciben cupones.
- El domicilio nunca forma parte de la base del descuento.
- Un pedido no combina cupón y descuento manual.
- La base de producción todavía usa `npx prisma db push`; no usar `prisma migrate deploy` hasta realizar un baseline formal.

## Antes de empezar un nuevo desarrollo

Confirmar primero:

1. que `main` contiene el último trabajo desplegado;
2. que `docs/CURRENT_STATE.md` coincide con el comportamiento actual;
3. si el cambio requiere modificar Prisma;
4. si el cambio afecta reglas comerciales existentes;
5. qué documento deberá actualizarse al terminar.

## Al cerrar cada bloque

Registrar en la respuesta y en el repositorio:

- commit final de `main`;
- qué cambió;
- si requiere `npx prisma db push`;
- qué debe probarse después del redeploy;
- cuál es el siguiente paso recomendado.

La documentación del repositorio tiene prioridad como fuente de continuidad frente al historial de chats.