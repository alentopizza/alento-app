# Alentó Repartidor Android

Aplicación Android ligera para el módulo de repartidores de Alentó Pizza.

## Objetivo de la V1

La interfaz sigue viviendo en:

`https://alentopizza.com/repartidor`

La APK añade capacidades nativas que una PWA no puede garantizar:

- WebView con sesión persistente.
- Geolocalización precisa.
- Foreground Location Service mientras el repartidor esté marcado como **Activo**.
- Seguimiento mientras Google Maps está abierto.
- Seguimiento con pantalla apagada, sujeto a la administración de batería del fabricante.
- Notificación permanente mientras el repartidor esté **Activo**; cambia de contenido durante una entrega.
- Al tocar la notificación, vuelve directamente al pedido.
- Al entregar, el servicio deja de actualizar ese pedido pero sigue reportando la ubicación general del repartidor. Solo se detiene al pasar a **Inactivo**.
- Si un pedido ya no acepta ubicación, se elimina únicamente el contexto de ese pedido. Si el backend indica que el repartidor está Inactivo, el servicio se detiene.

## Puente web → Android

La WebView expone:

```text
window.AlentoNative.platform()
window.AlentoNative.startAvailabilityTracking()
window.AlentoNative.setOrderTracking(token, orderCode, travelMode)
window.AlentoNative.clearOrderTracking()
window.AlentoNative.stopTracking()
window.AlentoNative.isTracking()
```

La aplicación web inicia el seguimiento general al pasar el repartidor a **Activo**. Al confirmar `OUT_FOR_DELIVERY` añade el pedido al servicio; al confirmar `DELIVERED` quita solo el pedido. Al pasar a **Inactivo** detiene por completo el servicio.

## Privacidad y permisos

La V1 **no solicita ACCESS_BACKGROUND_LOCATION**. El seguimiento se inicia desde una acción visible del repartidor y se mantiene mediante un Foreground Service de ubicación mientras permanezca Activo.

El servicio de ubicación se inicia desde la pantalla visible del pedido y se ejecuta como Foreground Service de tipo `location`, con una notificación permanente mientras comparte ubicación.

Antes de solicitar ubicación Android muestra una explicación:

> Alentó usa tu ubicación mientras realizas un domicilio, incluso si abres Maps o apagas la pantalla. El seguimiento empieza cuando inicias la entrega y se detiene cuando la marcas como entregada.

## Compilar localmente

Abrir la carpeta `android-driver` con Android Studio y ejecutar la configuración `app`.

Requisitos de referencia:

- JDK 17
- Android SDK 35
- Gradle 8.10.2
- Android Gradle Plugin 8.8.2

APK debug:

```text
app/build/outputs/apk/debug/app-debug.apk
```

## Primera prueba real

1. Instalar la APK debug.
2. Iniciar sesión como repartidor.
3. Abrir un pedido listo.
4. Elegir Pie, Moto o Vehículo.
5. Iniciar entrega.
6. Confirmar que aparece la notificación **Entrega en curso**.
7. Caminar/conducir unos metros con Alentó visible.
8. Abrir Google Maps y continuar.
9. Apagar pantalla y continuar.
10. Desde otro dispositivo revisar el mapa de entregas/seguimiento.
11. Volver a Alentó y marcar Entregado.
12. Confirmar que desaparece la notificación y deja de actualizar ubicación.

## Producción

Esta V1 usa un icono vectorial provisional. Antes de publicar en Play Store conviene sustituirlo por los assets oficiales del icono de Alentó y generar una firma release bajo control del propietario de Alentó.
