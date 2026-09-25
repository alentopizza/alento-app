package com.alentopizza.repartidor

import android.webkit.JavascriptInterface

class AlentoNativeBridge(
    private val activity: MainActivity,
) {
    @JavascriptInterface
    fun platform(): String = "android"

    @JavascriptInterface
    fun startTracking(
        token: String,
        orderCode: String,
        travelMode: String,
    ): Boolean {
        activity.runOnUiThread {
            activity.requestNativeTracking(
                token = token,
                orderCode = orderCode,
                travelMode = travelMode,
            )
        }
        return true
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
