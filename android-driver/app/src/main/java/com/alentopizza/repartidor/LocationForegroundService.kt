package com.alentopizza.repartidor

import android.Manifest
import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.graphics.Color
import android.location.Location
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.os.Looper
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import java.net.URL
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection

class LocationForegroundService : Service() {
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private val networkExecutor = Executors.newSingleThreadExecutor()

    private var activeToken: String? = null
    private var activeOrderCode: String = "Alentó"
    private var activeTravelMode: String = "VEHICLE"
    private var lastUploadAt = 0L

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            uploadLocation(location)
        }
    }

    override fun onCreate() {
        super.onCreate()
        fusedLocationClient =
            LocationServices.getFusedLocationProviderClient(this)
        createNotificationChannel()
    }

    override fun onStartCommand(
        intent: Intent?,
        flags: Int,
        startId: Int,
    ): Int {
        if (intent?.action == ACTION_STOP) {
            stopTracking()
            return START_NOT_STICKY
        }

        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val token =
            intent?.getStringExtra(EXTRA_TOKEN)
                ?: prefs.getString(PREF_TOKEN, null)
        val orderCode =
            intent?.getStringExtra(EXTRA_ORDER_CODE)
                ?: prefs.getString(PREF_ORDER_CODE, "Alentó")
                ?: "Alentó"
        val travelMode =
            intent?.getStringExtra(EXTRA_TRAVEL_MODE)
                ?: prefs.getString(PREF_TRAVEL_MODE, "VEHICLE")
                ?: "VEHICLE"

        if (token.isNullOrBlank()) {
            stopSelf()
            return START_NOT_STICKY
        }

        activeToken = token
        activeOrderCode = orderCode
        activeTravelMode = travelMode.uppercase()

        prefs.edit()
            .putBoolean(PREF_ACTIVE, true)
            .putString(PREF_TOKEN, token)
            .putString(PREF_ORDER_CODE, orderCode)
            .putString(PREF_TRAVEL_MODE, activeTravelMode)
            .apply()

        startAsForeground(token, orderCode)
        requestLocationUpdates()

        return START_STICKY
    }

    private fun startAsForeground(
        token: String,
        orderCode: String,
    ) {
        val path = "/repartidor/pedido/" + Uri.encode(token)
        val contentIntent = Intent(this, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_PATH, path)
            .addFlags(
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP,
            )

        val pendingIntent = PendingIntent.getActivity(
            this,
            NOTIFICATION_ID,
            contentIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or
                PendingIntent.FLAG_IMMUTABLE,
        )

        val notification = Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_alento)
            .setContentTitle("$orderCode · Entrega en curso")
            .setContentText("Compartiendo ubicación con Alentó.")
            .setSubText("GPS activo · toca para volver al pedido")
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setColor(Color.rgb(226, 26, 34))
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    @SuppressLint("MissingPermission")
    private fun requestLocationUpdates() {
        if (
            checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) !=
                PackageManager.PERMISSION_GRANTED &&
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) !=
                PackageManager.PERMISSION_GRANTED
        ) {
            stopTracking()
            return
        }

        fusedLocationClient.removeLocationUpdates(locationCallback)

        val mode = activeTravelMode.uppercase()
        val intervalMs = when (mode) {
            "WALK" -> 10_000L
            "MOTORCYCLE" -> 6_000L
            else -> 6_000L
        }
        val minimumIntervalMs = when (mode) {
            "WALK" -> 7_000L
            else -> 4_000L
        }
        val minimumDistanceMeters = when (mode) {
            "WALK" -> 4f
            "MOTORCYCLE" -> 8f
            else -> 10f
        }

        val request = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            intervalMs,
        )
            .setMinUpdateIntervalMillis(minimumIntervalMs)
            .setMinUpdateDistanceMeters(minimumDistanceMeters)
            .setWaitForAccurateLocation(false)
            .build()

        fusedLocationClient.requestLocationUpdates(
            request,
            locationCallback,
            Looper.getMainLooper(),
        )
    }

    private fun uploadLocation(location: Location) {
        val token = activeToken ?: return
        val now = System.currentTimeMillis()
        val minimumGap =
            if (activeTravelMode == "WALK") 6_000L else 4_000L

        if (now - lastUploadAt < minimumGap) return
        lastUploadAt = now

        networkExecutor.execute {
            val endpoint =
                BuildConfig.ALENTO_BASE_URL +
                    "/api/repartidor/pedido/" +
                    Uri.encode(token) +
                    "/location"

            val connection =
                (URL(endpoint).openConnection() as HttpsURLConnection)

            try {
                connection.requestMethod = "POST"
                connection.connectTimeout = 10_000
                connection.readTimeout = 10_000
                connection.doOutput = true
                connection.setRequestProperty(
                    "Content-Type",
                    "application/json",
                )
                connection.setRequestProperty(
                    "Accept",
                    "application/json",
                )

                val body =
                    "{" +
                        "\"latitude\":" + location.latitude + "," +
                        "\"longitude\":" + location.longitude + "," +
                        "\"accuracy\":" + location.accuracy +
                        "}"

                connection.outputStream.use { output ->
                    output.write(body.toByteArray(Charsets.UTF_8))
                }

                val code = connection.responseCode

                if (code == 401 || code == 404 || code == 409) {
                    mainExecutor.execute {
                        stopTracking()
                    }
                }
            } catch (_: Exception) {
                // Una falla de red no detiene el recorrido.
                // La siguiente lectura vuelve a intentar.
            } finally {
                connection.disconnect()
            }
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Entregas en curso",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description =
                "Ubicación activa durante los domicilios de Alentó."
            setShowBadge(false)
        }

        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }

    private fun stopTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        activeToken = null
        lastUploadAt = 0L

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .clear()
            .apply()

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        networkExecutor.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_START =
            "com.alentopizza.repartidor.START_TRACKING"
        const val ACTION_STOP =
            "com.alentopizza.repartidor.STOP_TRACKING"

        const val EXTRA_TOKEN = "token"
        const val EXTRA_ORDER_CODE = "order_code"
        const val EXTRA_TRAVEL_MODE = "travel_mode"

        const val PREFS_NAME = "alento_native_tracking"
        const val PREF_ACTIVE = "active"
        private const val PREF_TOKEN = "token"
        private const val PREF_ORDER_CODE = "order_code"
        private const val PREF_TRAVEL_MODE = "travel_mode"

        private const val CHANNEL_ID = "alento_delivery_tracking"
        private const val NOTIFICATION_ID = 2409
    }
}
