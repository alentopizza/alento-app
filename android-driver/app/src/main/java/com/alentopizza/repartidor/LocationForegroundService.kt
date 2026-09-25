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
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
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
    private val mainHandler = Handler(Looper.getMainLooper())

    private var activeToken: String? = null
    private var activeOrderCode: String? = null
    private var activeTravelMode: String = "VEHICLE"
    private var nativeLocationToken: String? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var lastGeneralUploadAt = 0L
    private var lastOrderUploadAt = 0L

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            uploadAvailabilityLocation(location)
            uploadOrderLocation(location)
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
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        val action = intent?.action

        if (action == ACTION_STOP) {
            stopTracking()
            return START_NOT_STICKY
        }

        if (action == ACTION_CLEAR_ORDER) {
            if (!prefs.getBoolean(PREF_ACTIVE, false)) {
                stopSelf()
                return START_NOT_STICKY
            }

            restoreOrderContext()
            clearOrderContext()
            startAsForeground()
            requestLocationUpdates()
            return START_STICKY
        }

        if (action == ACTION_SET_ORDER) {
            val token = intent?.getStringExtra(EXTRA_TOKEN)
            if (!token.isNullOrBlank()) {
                activeToken = token
                activeOrderCode =
                    intent?.getStringExtra(EXTRA_ORDER_CODE)
                        ?.ifBlank { "Alentó" }
                        ?: "Alentó"
                activeTravelMode =
                    intent?.getStringExtra(EXTRA_TRAVEL_MODE)
                        ?.ifBlank { "VEHICLE" }
                        ?.uppercase()
                        ?: "VEHICLE"

                prefs.edit()
                    .putBoolean(PREF_ACTIVE, true)
                    .putString(PREF_TOKEN, activeToken)
                    .putString(PREF_ORDER_CODE, activeOrderCode)
                    .putString(PREF_TRAVEL_MODE, activeTravelMode)
                    .apply()
            }
        } else if (action == ACTION_START_AVAILABILITY) {
            val nativeToken =
                intent?.getStringExtra(EXTRA_NATIVE_TOKEN)?.trim()

            if (nativeToken.isNullOrBlank()) {
                stopSelf()
                return START_NOT_STICKY
            }

            nativeLocationToken = nativeToken
            prefs.edit()
                .putBoolean(PREF_ACTIVE, true)
                .putString(PREF_NATIVE_TOKEN, nativeToken)
                .apply()
            restoreOrderContext()
        } else {
            if (!prefs.getBoolean(PREF_ACTIVE, false)) {
                stopSelf()
                return START_NOT_STICKY
            }
            restoreOrderContext()
        }

        nativeLocationToken =
            prefs.getString(PREF_NATIVE_TOKEN, nativeLocationToken)

        prefs.edit()
            .putBoolean(PREF_ACTIVE, true)
            .apply()

        startAsForeground()
        acquireWakeLock()
        requestLocationUpdates()

        return START_STICKY
    }

    private fun restoreOrderContext() {
        val prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
        activeToken = prefs.getString(PREF_TOKEN, null)
        activeOrderCode = prefs.getString(PREF_ORDER_CODE, null)
        activeTravelMode =
            prefs.getString(PREF_TRAVEL_MODE, "VEHICLE")
                ?.uppercase()
                ?: "VEHICLE"
        nativeLocationToken =
            prefs.getString(PREF_NATIVE_TOKEN, nativeLocationToken)
    }

    private fun startAsForeground() {
        val notification = buildNotification()

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

    private fun buildNotification(): Notification {
        val token = activeToken
        val path =
            if (!token.isNullOrBlank()) {
                "/repartidor/pedido/" + Uri.encode(token)
            } else {
                "/repartidor"
            }

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

        val title =
            if (!token.isNullOrBlank()) {
                "${activeOrderCode ?: "Alentó"} · Entrega en curso"
            } else {
                "Alentó · Repartidor activo"
            }

        val body =
            if (!token.isNullOrBlank()) {
                "Compartiendo tu ubicación y la ruta del domicilio."
            } else {
                "Compartiendo tu ubicación con el panel de Alentó."
            }

        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_alento)
            .setContentTitle(title)
            .setContentText(body)
            .setSubText("GPS activo · toca para volver a Alentó")
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setColor(Color.rgb(226, 26, 34))
            .build()
    }

    private fun refreshNotification() {
        getSystemService(NotificationManager::class.java)
            .notify(NOTIFICATION_ID, buildNotification())
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

        val hasOrder = !activeToken.isNullOrBlank()
        val intervalMs =
            if (!hasOrder) {
                10_000L
            } else {
                when (activeTravelMode) {
                    "WALK" -> 8_000L
                    "MOTORCYCLE" -> 5_000L
                    else -> 5_000L
                }
            }

        val minimumIntervalMs =
            if (!hasOrder) 7_000L else 4_000L

        val request = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            intervalMs,
        )
            .setMinUpdateIntervalMillis(minimumIntervalMs)
            .setMaxUpdateDelayMillis(intervalMs)
            .setWaitForAccurateLocation(false)
            .build()

        fusedLocationClient.requestLocationUpdates(
            request,
            locationCallback,
            Looper.getMainLooper(),
        )

        refreshNotification()
    }

    private fun uploadAvailabilityLocation(location: Location) {
        val now = System.currentTimeMillis()
        val minimumGap =
            if (activeToken.isNullOrBlank()) 8_000L else 5_000L

        if (now - lastGeneralUploadAt < minimumGap) return
        lastGeneralUploadAt = now

        networkExecutor.execute {
            val code = postLocation(
                BuildConfig.ALENTO_BASE_URL + "/api/repartidor/location",
                location,
                nativeToken = nativeLocationToken,
            )

            if (
                code == 401 ||
                code == 403 ||
                code == 404 ||
                code == 409
            ) {
                mainHandler.post {
                    stopTracking()
                }
            }
        }
    }

    private fun uploadOrderLocation(location: Location) {
        val token = activeToken ?: return
        val now = System.currentTimeMillis()
        val minimumGap =
            if (activeTravelMode == "WALK") 6_000L else 4_000L

        if (now - lastOrderUploadAt < minimumGap) return
        lastOrderUploadAt = now

        networkExecutor.execute {
            val endpoint =
                BuildConfig.ALENTO_BASE_URL +
                    "/api/repartidor/pedido/" +
                    Uri.encode(token) +
                    "/location"

            val code = postLocation(
                endpoint,
                location,
                nativeToken = null,
            )

            if (code == 401 || code == 404 || code == 409) {
                mainHandler.post {
                    clearOrderContext()
                    requestLocationUpdates()
                }
            }
        }
    }

    private fun postLocation(
        endpoint: String,
        location: Location,
        nativeToken: String?,
    ): Int? {
        val connection =
            (URL(endpoint).openConnection() as HttpsURLConnection)

        return try {
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
            connection.setRequestProperty(
                "User-Agent",
                "AlentoDriverAndroid/0.3",
            )

            if (!nativeToken.isNullOrBlank()) {
                connection.setRequestProperty(
                    "X-Alento-Driver-Location-Token",
                    nativeToken,
                )
            }

            val body =
                """{"latitude":${location.latitude},"longitude":${location.longitude},"accuracy":${location.accuracy}}"""

            connection.outputStream.use { output ->
                output.write(body.toByteArray(Charsets.UTF_8))
            }

            connection.responseCode
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }

    private fun clearOrderContext() {
        activeToken = null
        activeOrderCode = null
        activeTravelMode = "VEHICLE"
        lastOrderUploadAt = 0L

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .remove(PREF_TOKEN)
            .remove(PREF_ORDER_CODE)
            .remove(PREF_TRAVEL_MODE)
            .apply()

        refreshNotification()
    }

    private fun acquireWakeLock() {
        val existing = wakeLock
        if (existing?.isHeld == true) return

        val powerManager =
            getSystemService(PowerManager::class.java)
        wakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "AlentoDriver:ActiveLocation",
        ).apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseWakeLock() {
        val lock = wakeLock
        if (lock?.isHeld == true) {
            lock.release()
        }
        wakeLock = null
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Ubicación del repartidor",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description =
                "Ubicación activa mientras el repartidor está disponible."
            setShowBadge(false)
        }

        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }

    private fun stopTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        activeToken = null
        activeOrderCode = null
        activeTravelMode = "VEHICLE"
        nativeLocationToken = null
        lastGeneralUploadAt = 0L
        lastOrderUploadAt = 0L

        getSharedPreferences(PREFS_NAME, MODE_PRIVATE)
            .edit()
            .clear()
            .apply()

        releaseWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        releaseWakeLock()
        networkExecutor.shutdownNow()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    companion object {
        const val ACTION_START_AVAILABILITY =
            "com.alentopizza.repartidor.START_AVAILABILITY"
        const val ACTION_SET_ORDER =
            "com.alentopizza.repartidor.SET_ORDER"
        const val ACTION_CLEAR_ORDER =
            "com.alentopizza.repartidor.CLEAR_ORDER"
        const val ACTION_STOP =
            "com.alentopizza.repartidor.STOP_TRACKING"

        const val EXTRA_TOKEN = "token"
        const val EXTRA_ORDER_CODE = "order_code"
        const val EXTRA_TRAVEL_MODE = "travel_mode"
        const val EXTRA_NATIVE_TOKEN = "native_location_token"

        const val PREFS_NAME = "alento_native_tracking"
        const val PREF_ACTIVE = "active"
        private const val PREF_TOKEN = "token"
        private const val PREF_ORDER_CODE = "order_code"
        private const val PREF_TRAVEL_MODE = "travel_mode"
        private const val PREF_NATIVE_TOKEN = "native_location_token"

        private const val CHANNEL_ID = "alento_driver_location"
        private const val NOTIFICATION_ID = 2409
    }
}
