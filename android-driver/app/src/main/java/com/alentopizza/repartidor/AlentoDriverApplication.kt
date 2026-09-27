package com.alentopizza.repartidor

import android.app.Application

class AlentoDriverApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        NativePushManager.initializeFromStoredConfig(this)
    }
}
