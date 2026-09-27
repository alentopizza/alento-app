package com.alentopizza.repartidor

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    private lateinit var webView: WebView

    private var pendingTracking: PendingTracking? = null
    private var pendingGeoOrigin: String? = null
    private var pendingGeoCallback: GeolocationPermissions.Callback? = null
    private var disclosureVisible = false

    data class PendingTracking(
        val action: String,
        val token: String? = null,
        val orderCode: String? = null,
        val travelMode: String? = null,
        val nativeToken: String? = null,
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        webView = WebView(this)
        webView.setBackgroundColor(Color.rgb(8, 8, 8))
        setContentView(webView)

        configureWebView()

        if (savedInstanceState == null) {
            loadFromIntent(intent)
        } else {
            webView.restoreState(savedInstanceState)
            handlePushIntent(intent)
        }
    }

    private fun configureWebView() {
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            setGeolocationEnabled(true)
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = false
            userAgentString = userAgentString + " AlentoDriverAndroid/0.4"
        }

        webView.addJavascriptInterface(AlentoNativeBridge(this), "AlentoNative")

        webView.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback,
            ) {
                if (!isTrustedOrigin(origin)) {
                    callback.invoke(origin, false, false)
                    return
                }

                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false)
                    return
                }

                pendingGeoOrigin = origin
                pendingGeoCallback = callback

                runOnUiThread {
                    showLocationDisclosure(
                        onContinue = { requestLocationPermission() },
                        onCancel = {
                            pendingGeoCallback?.invoke(
                                pendingGeoOrigin,
                                false,
                                false,
                            )
                            pendingGeoOrigin = null
                            pendingGeoCallback = null
                        },
                    )
                }
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean {
                return handleNavigation(request.url)
            }

            @Suppress("DEPRECATION")
            override fun shouldOverrideUrlLoading(
                view: WebView,
                url: String,
            ): Boolean {
                return handleNavigation(Uri.parse(url))
            }
        }
    }

    private fun handleNavigation(uri: Uri): Boolean {
        val scheme = uri.scheme.orEmpty().lowercase()

        if (scheme == "tel") {
            runCatching {
                startActivity(Intent(Intent.ACTION_DIAL, uri))
            }
            return true
        }

        if (scheme == "http" || scheme == "https") {
            if (isTrustedHost(uri.host)) {
                return false
            }

            runCatching {
                startActivity(Intent(Intent.ACTION_VIEW, uri))
            }
            return true
        }

        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, uri))
        }
        return true
    }

    private fun isTrustedOrigin(origin: String): Boolean {
        return runCatching {
            val uri = Uri.parse(origin)
            uri.scheme == "https" && isTrustedHost(uri.host)
        }.getOrDefault(false)
    }

    private fun isTrustedHost(host: String?): Boolean {
        val normalized = host?.lowercase().orEmpty()
        return normalized == "alentopizza.com" ||
            normalized == "www.alentopizza.com"
    }

    private fun loadFromIntent(sourceIntent: Intent) {
        if (handlePushIntent(sourceIntent)) return

        val requestedPath = sourceIntent.getStringExtra(EXTRA_PATH)
        loadDriverPath(requestedPath ?: "/repartidor")
    }

    private fun handlePushIntent(sourceIntent: Intent): Boolean {
        val campaignId =
            sourceIntent.getStringExtra(EXTRA_PUSH_CAMPAIGN_ID)
                ?.trim()
                .orEmpty()
        val target =
            sourceIntent.getStringExtra(EXTRA_PUSH_TARGET)
                ?.trim()
                .orEmpty()

        if (campaignId.isNotBlank()) {
            NativePushManager.recordOpen(this, campaignId)
        }

        if (target.isBlank()) {
            return campaignId.isNotBlank()
        }

        if (target.startsWith("https://") || target.startsWith("http://")) {
            runCatching {
                startActivity(
                    Intent(Intent.ACTION_VIEW, Uri.parse(target)),
                )
            }
            return true
        }

        if (target.startsWith("/") && !target.startsWith("//")) {
            webView.loadUrl(BuildConfig.ALENTO_BASE_URL + target)
            return true
        }

        return campaignId.isNotBlank()
    }

    private fun loadDriverPath(path: String) {
        val safePath =
            if (path.startsWith("/repartidor")) path else "/repartidor"
        webView.loadUrl(BuildConfig.ALENTO_BASE_URL + safePath)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        loadFromIntent(intent)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Suppress("DEPRECATION")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    fun requestNativeAvailabilityTracking(nativeToken: String) {
        if (nativeToken.isBlank()) return

        requestNativeTracking(
            PendingTracking(
                action = LocationForegroundService.ACTION_START_AVAILABILITY,
                nativeToken = nativeToken,
            ),
        )
    }

    fun requestNativeOrderTracking(
        token: String,
        orderCode: String,
        travelMode: String,
    ) {
        if (token.isBlank()) return

        requestNativeTracking(
            PendingTracking(
                action = LocationForegroundService.ACTION_SET_ORDER,
                token = token,
                orderCode = orderCode.ifBlank { "Alentó" },
                travelMode = travelMode.ifBlank { "VEHICLE" },
            ),
        )
    }

    private fun requestNativeTracking(pending: PendingTracking) {
        if (!hasLocationPermission()) {
            pendingTracking = pending
            showLocationDisclosure(
                onContinue = { requestLocationPermission() },
                onCancel = { pendingTracking = null },
            )
            return
        }

        startTrackingService(pending)
        requestNotificationPermissionIfNeeded()
    }

    fun openExternalNavigation(
        latitude: Double,
        longitude: Double,
        travelMode: String,
    ) {
        if (!latitude.isFinite() || !longitude.isFinite()) return

        val normalizedMode =
            if (travelMode.trim().uppercase() == "WALK") "w" else "d"
        val navigationUri =
            Uri.parse("google.navigation:q=$latitude,$longitude&mode=$normalizedMode")

        val openedGoogleMaps = runCatching {
            val mapsIntent = Intent(Intent.ACTION_VIEW, navigationUri)
                .setPackage("com.google.android.apps.maps")
            startActivity(mapsIntent)
        }.isSuccess

        if (openedGoogleMaps) return

        val webTravelMode =
            if (normalizedMode == "w") "walking" else "driving"
        val fallbackUri = Uri.parse(
            "https://www.google.com/maps/dir/?api=1" +
                "&destination=$latitude,$longitude" +
                "&travelmode=$webTravelMode" +
                "&dir_action=navigate",
        )

        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, fallbackUri))
        }
    }

    fun configureNativePush(
        nativeToken: String,
        apiKey: String,
        appId: String,
        projectId: String,
        senderId: String,
    ): Boolean {
        requestNotificationPermissionIfNeeded()

        return NativePushManager.configure(
            context = this,
            nativeToken = nativeToken,
            apiKey = apiKey,
            appId = appId,
            projectId = projectId,
            senderId = senderId,
        )
    }

    fun clearNativeOrderTracking() {
        val intent = Intent(this, LocationForegroundService::class.java)
            .setAction(LocationForegroundService.ACTION_CLEAR_ORDER)
        startService(intent)
    }

    fun stopNativeTracking() {
        pendingTracking = null

        val intent = Intent(this, LocationForegroundService::class.java)
            .setAction(LocationForegroundService.ACTION_STOP)
        startService(intent)
    }

    fun nativeTrackingActive(): Boolean {
        return getSharedPreferences(
            LocationForegroundService.PREFS_NAME,
            MODE_PRIVATE,
        ).getBoolean(LocationForegroundService.PREF_ACTIVE, false)
    }

    private fun startTrackingService(pending: PendingTracking) {
        val intent = Intent(this, LocationForegroundService::class.java)
            .setAction(pending.action)

        pending.token?.let {
            intent.putExtra(LocationForegroundService.EXTRA_TOKEN, it)
        }
        pending.orderCode?.let {
            intent.putExtra(LocationForegroundService.EXTRA_ORDER_CODE, it)
        }
        pending.travelMode?.let {
            intent.putExtra(LocationForegroundService.EXTRA_TRAVEL_MODE, it)
        }
        pending.nativeToken?.let {
            intent.putExtra(LocationForegroundService.EXTRA_NATIVE_TOKEN, it)
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    private fun hasLocationPermission(): Boolean {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED ||
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun requestLocationPermission() {
        requestPermissions(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
            ),
            REQUEST_LOCATION,
        )
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) !=
                PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                REQUEST_NOTIFICATIONS,
            )
        }
    }

    private fun showLocationDisclosure(
        onContinue: () -> Unit,
        onCancel: () -> Unit,
    ) {
        if (disclosureVisible) return
        disclosureVisible = true

        AlertDialog.Builder(this)
            .setTitle(getString(R.string.location_disclosure_title))
            .setMessage(getString(R.string.location_disclosure_body))
            .setPositiveButton("Continuar") { _, _ ->
                disclosureVisible = false
                onContinue()
            }
            .setNegativeButton("Ahora no") { _, _ ->
                disclosureVisible = false
                onCancel()
            }
            .setOnCancelListener {
                disclosureVisible = false
                onCancel()
            }
            .show()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(
            requestCode,
            permissions,
            grantResults,
        )

        if (requestCode != REQUEST_LOCATION) return

        val granted = hasLocationPermission()

        pendingGeoCallback?.invoke(
            pendingGeoOrigin,
            granted,
            false,
        )
        pendingGeoOrigin = null
        pendingGeoCallback = null

        val pending = pendingTracking
        pendingTracking = null

        if (granted && pending != null) {
            startTrackingService(pending)
            requestNotificationPermissionIfNeeded()
        }
    }

    companion object {
        const val EXTRA_PATH = "alento_path"
        const val EXTRA_PUSH_TARGET = "alento_push_target"
        const val EXTRA_PUSH_CAMPAIGN_ID = "alento_push_campaign_id"
        private const val REQUEST_LOCATION = 2409
        private const val REQUEST_NOTIFICATIONS = 2410
    }
}
