package com.alentopizza.repartidor

import android.webkit.JavascriptInterface

class AlentoNativeBridge(
    private val activity: MainActivity,
) {
    @JavascriptInterface
    fun platform(): String = "android"

    @JavascriptInterface
    fun startAvailabilityTracking(nativeToken: String): Boolean {
        activity.runOnUiThread {
            activity.requestNativeAvailabilityTracking(nativeToken)
        }
        return true
    }

    @JavascriptInterface
    fun setOrderTracking(
        token: String,
        orderCode: String,
        travelMode: String,
    ): Boolean {
        activity.runOnUiThread {
            activity.requestNativeOrderTracking(
                token = token,
                orderCode = orderCode,
                travelMode = travelMode,
            )
        }
        return true
    }

    @JavascriptInterface
    fun configurePush(
        nativeToken: String,
        apiKey: String,
        appId: String,
        projectId: String,
        senderId: String,
    ): Boolean {
        activity.runOnUiThread {
            activity.configureNativePush(
                nativeToken = nativeToken,
                apiKey = apiKey,
                appId = appId,
                projectId = projectId,
                senderId = senderId,
            )
        }
        return true
    }

    @JavascriptInterface
    fun openExternalNavigation(
        latitude: Double,
        longitude: Double,
        travelMode: String,
    ): Boolean {
        activity.runOnUiThread {
            activity.openExternalNavigation(
                latitude = latitude,
                longitude = longitude,
                travelMode = travelMode,
            )
        }
        return true
    }

    @JavascriptInterface
    fun clearOrderTracking() {
        activity.runOnUiThread {
            activity.clearNativeOrderTracking()
        }
    }

    @JavascriptInterface
    fun stopTracking() {
        activity.runOnUiThread {
            activity.stopNativeTracking()
        }
    }

    @JavascriptInterface
    fun isTracking(): Boolean {
        return activity.nativeTrackingActive()
    }
}
