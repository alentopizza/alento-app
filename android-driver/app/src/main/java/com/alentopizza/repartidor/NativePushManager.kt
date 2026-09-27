package com.alentopizza.repartidor

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.net.URL
import java.util.UUID
import java.util.concurrent.Executors
import javax.net.ssl.HttpsURLConnection

object NativePushManager {
    private const val PREFS_NAME = "alento_native_push"
    private const val PREF_AUTH_TOKEN = "auth_token"
    private const val PREF_DEVICE_KEY = "device_key"
    private const val PREF_FCM_TOKEN = "fcm_token"

    private val executor = Executors.newSingleThreadExecutor()

    fun configure(
        context: Context,
        nativeToken: String,
        apiKey: String,
        appId: String,
        projectId: String,
        senderId: String,
    ): Boolean {
        if (
            nativeToken.isBlank() ||
            apiKey.isBlank() ||
            appId.isBlank() ||
            projectId.isBlank() ||
            senderId.isBlank()
        ) {
            return false
        }

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString(PREF_AUTH_TOKEN, nativeToken)
            .apply()

        ensureDeviceKey(context)

        if (FirebaseApp.getApps(context).isEmpty()) {
            val options = FirebaseOptions.Builder()
                .setApiKey(apiKey)
                .setApplicationId(appId)
                .setProjectId(projectId)
                .setGcmSenderId(senderId)
                .build()

            FirebaseApp.initializeApp(context, options)
        }

        FirebaseMessaging.getInstance().token
            .addOnCompleteListener { task ->
                val token = task.result
                if (task.isSuccessful && !token.isNullOrBlank()) {
                    onNewToken(context, token)
                }
            }

        return true
    }

    fun onNewToken(context: Context, token: String) {
        if (token.isBlank()) return

        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_FCM_TOKEN, token)
            .apply()

        registerCurrentToken(context)
    }

    fun registerCurrentToken(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val authToken = prefs.getString(PREF_AUTH_TOKEN, null)?.trim()
        val fcmToken = prefs.getString(PREF_FCM_TOKEN, null)?.trim()

        if (authToken.isNullOrBlank() || fcmToken.isNullOrBlank()) return

        val deviceKey = ensureDeviceKey(context)

        executor.execute {
            postJson(
                endpoint = BuildConfig.ALENTO_BASE_URL +
                    "/api/repartidor/native-push/register",
                nativeToken = authToken,
                body = JSONObject()
                    .put("deviceKey", deviceKey)
                    .put("fcmToken", fcmToken)
                    .put("appVersion", BuildConfig.VERSION_NAME),
            )
        }
    }

    fun recordOpen(context: Context, campaignId: String) {
        if (campaignId.isBlank()) return

        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val authToken = prefs.getString(PREF_AUTH_TOKEN, null)?.trim()
        if (authToken.isNullOrBlank()) return

        val deviceKey = ensureDeviceKey(context)

        executor.execute {
            postJson(
                endpoint = BuildConfig.ALENTO_BASE_URL +
                    "/api/push-campaigns/" +
                    campaignId +
                    "/open",
                nativeToken = authToken,
                body = JSONObject()
                    .put("channel", "ANDROID")
                    .put("deviceKey", deviceKey),
            )
        }
    }

    private fun ensureDeviceKey(context: Context): String {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val existing = prefs.getString(PREF_DEVICE_KEY, null)?.trim()
        if (!existing.isNullOrBlank()) return existing

        val generated = UUID.randomUUID().toString()
        prefs.edit()
            .putString(PREF_DEVICE_KEY, generated)
            .apply()

        return generated
    }

    private fun postJson(
        endpoint: String,
        nativeToken: String,
        body: JSONObject,
    ): Int? {
        val connection =
            (URL(endpoint).openConnection() as HttpsURLConnection)

        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty(
                "User-Agent",
                "AlentoDriverAndroid/${BuildConfig.VERSION_NAME}",
            )
            connection.setRequestProperty(
                "X-Alento-Driver-Location-Token",
                nativeToken,
            )

            connection.outputStream.use { output ->
                output.write(body.toString().toByteArray(Charsets.UTF_8))
            }

            connection.responseCode
        } catch (_: Exception) {
            null
        } finally {
            connection.disconnect()
        }
    }
}
