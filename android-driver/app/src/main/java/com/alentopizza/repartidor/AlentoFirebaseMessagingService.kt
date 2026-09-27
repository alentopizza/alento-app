package com.alentopizza.repartidor

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Build
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.net.URL
import javax.net.ssl.HttpsURLConnection

class AlentoFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        NativePushManager.onNewToken(this, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title = data["title"]?.ifBlank { "Alentó Pizza" } ?: "Alentó Pizza"
        val subtitle = data["subtitle"]?.trim().orEmpty()
        val body = data["body"]?.trim().orEmpty()
        val target = data["path"]?.trim().orEmpty()
        val campaignId = data["campaignId"]?.trim().orEmpty()
        val imageUrl = data["imageUrl"]?.trim().orEmpty()

        createChannel()

        val requestCode =
            if (campaignId.isNotBlank()) campaignId.hashCode()
            else System.currentTimeMillis().toInt()

        val pendingIntent =
            if (target.isBlank() && campaignId.isNotBlank()) {
                val intent = Intent(this, PushOpenReceiver::class.java)
                    .putExtra(
                        MainActivity.EXTRA_PUSH_CAMPAIGN_ID,
                        campaignId,
                    )

                PendingIntent.getBroadcast(
                    this,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or
                        PendingIntent.FLAG_IMMUTABLE,
                )
            } else {
                val intent = Intent(this, MainActivity::class.java)
                    .addFlags(
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP,
                    )
                    .putExtra(MainActivity.EXTRA_PUSH_TARGET, target)
                    .putExtra(
                        MainActivity.EXTRA_PUSH_CAMPAIGN_ID,
                        campaignId,
                    )

                PendingIntent.getActivity(
                    this,
                    requestCode,
                    intent,
                    PendingIntent.FLAG_UPDATE_CURRENT or
                        PendingIntent.FLAG_IMMUTABLE,
                )
            }

        val builder = Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_alento)
            .setContentTitle(title)
            .setContentText(body)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setVisibility(Notification.VISIBILITY_PRIVATE)
            .setColor(Color.rgb(226, 26, 34))
            .setPriority(Notification.PRIORITY_HIGH)

        if (subtitle.isNotBlank()) {
            builder.setSubText(subtitle)
        }

        val picture = loadImage(imageUrl)
        if (picture != null) {
            builder.setLargeIcon(picture)
            builder.setStyle(
                Notification.BigPictureStyle()
                    .bigPicture(picture)
                    .setBigContentTitle(title)
                    .setSummaryText(
                        listOf(subtitle, body)
                            .filter { it.isNotBlank() }
                            .joinToString(" · "),
                    ),
            )
        } else if (body.isNotBlank()) {
            builder.setStyle(
                Notification.BigTextStyle()
                    .bigText(body)
                    .setBigContentTitle(title),
            )
        }

        getSystemService(NotificationManager::class.java)
            .notify(requestCode, builder.build())
    }

    private fun loadImage(value: String): Bitmap? {
        if (!value.startsWith("https://")) return null

        return runCatching {
            val connection =
                (URL(value).openConnection() as HttpsURLConnection)
            try {
                connection.connectTimeout = 6_000
                connection.readTimeout = 6_000
                connection.inputStream.use(BitmapFactory::decodeStream)
            } finally {
                connection.disconnect()
            }
        }.getOrNull()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val channel = NotificationChannel(
            CHANNEL_ID,
            "Mensajes de Alentó",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description =
                "Pedidos, novedades y mensajes enviados desde Alentó Pizza."
            enableVibration(true)
            setShowBadge(true)
        }

        getSystemService(NotificationManager::class.java)
            .createNotificationChannel(channel)
    }

    companion object {
        private const val CHANNEL_ID = "alento_driver_messages_v1"
    }
}
