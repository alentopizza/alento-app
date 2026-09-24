# Módulos exclusivos de Alentó Pizza

Última actualización: 2026-09-23.

Este documento define qué partes del repositorio pertenecen a la operación particular de **Alentó Pizza** y no forman parte del núcleo genérico/reutilizable de una futura distribución comercial del proyecto para otras pizzerías.

La regla es deliberada: el producto base debe poder operar como sistema de pizzería sin exigir infraestructura externa de Alentó ni exponer propiedad intelectual de su receta.

## Regla de producto

El núcleo replicable puede incluir:

- catálogo y Menú;
- POS;
- pedidos;
- Cocina;
- clientes;
- pagos y Caja básica;
- configuración de sede y domicilios;
- experiencia pública;
- reparto y seguimiento;
- usuarios y roles;
- cupones;
- mecanismos de extensión para integraciones.

Los módulos descritos a continuación se consideran **extensiones exclusivas de Alentó** y no deben copiarse automáticamente a una edición genérica.

---

## 1. Preparación de masa y receta Alentó

Superficies actuales:

- `/masa`;
- `GET/POST/DELETE /api/dough-preparations`;
- modelo `DoughPreparation`;
- gramajes de bolas;
- porcentajes de hidratación y demás ingredientes;
- composición del **ADN Alentó** mostrada por la interfaz.

Motivo de exclusión:

- contiene una receta y proceso propio de Alentó Pizza;
- los porcentajes, gramajes y ADN forman parte del know-how operativo de la marca;
- no es una capacidad necesaria para que el software genérico gestione una pizzería.

### Regla

Una versión replicable/comercial:

- **NO** debe incluir la receta, porcentajes, gramajes ni composición del ADN de Alentó;
- **NO** debe distribuir el historial `DoughPreparation` como funcionalidad estándar;
- si en el futuro se desea ofrecer producción/recetas a terceros, debe crearse un módulo parametrizable distinto, sin valores ni fórmulas de Alentó.

En el repositorio operativo de Alentó, `/masa` permanece válido y está protegido para `ADMIN` y `KITCHEN`.

---

## 2. Ecosistema WhatsApp / Meta / notifier

Superficies actuales:

- `/notificaciones`;
- `/api/notification-templates`;
- `/api/notification-images/**`;
- `src/lib/notificationTemplates.ts`;
- `src/lib/notifier.ts`;
- `/api/internal/notification-jobs/run`;
- variables `NOTIFIER_WEBHOOK_URL` y `NOTIFIER_SHARED_SECRET`;
- entrega de OTP de clientes mediante `MAKE_WHATSAPP_OTP_WEBHOOK_URL`.

Motivo de exclusión:

- requiere infraestructura externa y credenciales que no pertenecen al núcleo del sistema;
- la mensajería real depende del ecosistema Meta/WhatsApp y del servicio externo que procese los eventos;
- el envío de reseñas diferidas necesita además un ejecutor/scheduler que invoque el endpoint de trabajos;
- no todas las instalaciones adquirirán pizzería + Meta + automatización/notifier.

### Regla

El núcleo genérico debe funcionar con las notificaciones desactivadas.

Actualmente el código ya respeta esta idea para eventos operativos: si el notifier no está configurado, el pedido continúa y el envío se marca como omitido/fallido sin impedir la operación.

El login de clientes por OTP es una capacidad opcional dependiente de proveedor. La navegación pública y el checkout como invitado deben continuar funcionando aunque una distribución genérica no incluya ese proveedor.

Una futura edición genérica debe ofrecer una **interfaz/adaptador de mensajería**, no las plantillas, nombres, imágenes, credenciales ni automatizaciones específicas de Alentó.

---

## 3. Integración Chatwoot

Superficies actuales:

- `/integraciones/chatwoot`;
- `GET /api/integrations/chatwoot/customer`;
- variable `CHATWOOT_DASHBOARD_KEY`;
- origen Chatwoot configurado para la infraestructura actual de Alentó.

La integración muestra dentro de Chatwoot:

- identificación del cliente;
- señal comercial;
- puntos Club;
- métricas;
- últimas compras.

Motivo de exclusión:

- necesita una instalación de Chatwoot;
- requiere Dashboard App, clave compartida y configuración de origen;
- forma parte del ecosistema operativo particular de Alentó;
- no es requisito para POS, Cocina, Pedidos, Caja o reparto.

### Regla

Una distribución genérica no debe asumir que existe Chatwoot.

Si en el futuro se comercializa como add-on, debe separarse como integración opcional con configuración propia del comprador.

---

## Qué NO significa “exclusivo”

No significa que estos módulos deban borrarse del repositorio operativo de Alentó.

Significa que:

1. permanecen disponibles para Alentó;
2. se protegen y mantienen como código de la instalación actual;
3. no se consideran requisito de cierre del producto genérico;
4. no deben copiarse por defecto cuando se prepare una versión para terceros;
5. nunca se deben publicar secretos, claves, URLs privadas ni receta propietaria en documentación comercial.

---

## Regla para futuras IAs/desarrolladores

Antes de preparar una versión reutilizable, fork, paquete comercial o instalación para otra pizzería:

1. leer este documento;
2. excluir o sustituir los módulos aquí listados;
3. conservar solamente contratos/adaptadores genéricos cuando sea necesario;
4. revisar que no queden fórmulas, imágenes, nombres de plantilla, dominios, secretos o configuraciones exclusivas de Alentó;
5. verificar que POS → Pedidos → Cocina → Pago/Caja → Reparto funcione sin estas extensiones.
