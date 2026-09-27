package com.alentopizza.repartidor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class PushOpenReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val campaignId =
            intent.getStringExtra(MainActivity.EXTRA_PUSH_CAMPAIGN_ID)
                ?.trim()
                .orEmpty()

        if (campaignId.isNotBlank()) {
            NativePushManager.recordOpen(context, campaignId)
        }
    }
}
