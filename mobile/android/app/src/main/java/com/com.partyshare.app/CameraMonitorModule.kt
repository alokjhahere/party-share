package com.partyshare.app

import android.content.Intent
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.*

class CameraMonitorModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    init {
        Companion.reactContext = reactContext
    }

    companion object {
        const val TAG = "CameraMonitorModule"
        
        @JvmStatic
        var reactContext: ReactApplicationContext? = null
            private set
    }

    override fun getName(): String {
        return "CameraMonitor"
    }

    @ReactMethod
    fun startMonitoring(eventId: String, backendUrl: String, startTimeMs: Double) {
        val context = reactApplicationContext
        Log.d(TAG, "startMonitoring called for eventId: $eventId, backendUrl: $backendUrl, startTimeMs: $startTimeMs")

        try {
            val intent = Intent(context, CameraObserverService::class.java).apply {
                putExtra("eventId", eventId)
                putExtra("backendUrl", backendUrl)
                // React Native passes numbers as Double, we cast to Long
                putExtra("startTimeMs", startTimeMs.toLong())
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            Log.i(TAG, "CameraObserverService start intent sent")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start CameraObserverService", e)
        }
    }

    @ReactMethod
    fun stopMonitoring() {
        val context = reactApplicationContext
        Log.d(TAG, "stopMonitoring called")

        try {
            val intent = Intent(context, CameraObserverService::class.java)
            context.stopService(intent)
            Log.i(TAG, "CameraObserverService stop service request sent")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to stop CameraObserverService", e)
        }
    }

    @ReactMethod
    fun isMonitoring(promise: Promise) {
        val running = CameraObserverService.isRunning
        Log.d(TAG, "isMonitoring query: $running")
        promise.resolve(running)
    }
}
