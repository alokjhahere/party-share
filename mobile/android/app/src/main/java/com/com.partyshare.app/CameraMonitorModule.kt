package com.partyshare.app

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import com.facebook.react.bridge.*
import java.io.InputStream
import java.io.OutputStream
import java.net.URL

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

    @ReactMethod
    fun saveImageToGallery(imageUrl: String, promise: Promise) {
        val context = reactApplicationContext
        Thread {
            try {
                // 1. Download image bytes
                val url = URL(imageUrl)
                val connection = url.openConnection()
                connection.connect()
                val inputStream: InputStream = connection.getInputStream()

                // 2. Prepare MediaStore metadata
                val filename = "partyshare_${System.currentTimeMillis()}.jpg"
                val contentValues = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, filename)
                    put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/PartyShare")
                        put(MediaStore.Images.Media.IS_PENDING, 1)
                    }
                }

                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, contentValues)

                if (uri == null) {
                    promise.reject("SAVE_FAILED", "Failed to insert MediaStore entry")
                    return@Thread
                }

                // 3. Write bytes to MediaStore output stream
                val outputStream: OutputStream? = resolver.openOutputStream(uri)
                if (outputStream == null) {
                    promise.reject("SAVE_FAILED", "Failed to open output stream")
                    return@Thread
                }

                val buffer = ByteArray(4096)
                var bytesRead: Int
                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    outputStream.write(buffer, 0, bytesRead)
                }
                outputStream.close()
                inputStream.close()

                // 4. Set pending to 0 for Android Q+
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    contentValues.clear()
                    contentValues.put(MediaStore.Images.Media.IS_PENDING, 0)
                    resolver.update(uri, contentValues, null, null)
                }

                promise.resolve(uri.toString())
            } catch (e: Exception) {
                Log.e(TAG, "Failed to save image to gallery", e)
                promise.reject("SAVE_FAILED", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun setAutoSavePreference(enabled: Boolean) {
        val sharedPref = reactApplicationContext.getSharedPreferences("PartySharePrefs", Context.MODE_PRIVATE)
        sharedPref.edit().putBoolean("autoSave", enabled).apply()
        Log.d(TAG, "Auto-save preference saved: $enabled")
    }

    @ReactMethod
    fun getAutoSavePreference(promise: Promise) {
        val sharedPref = reactApplicationContext.getSharedPreferences("PartySharePrefs", Context.MODE_PRIVATE)
        val enabled = sharedPref.getBoolean("autoSave", false)
        Log.d(TAG, "Auto-save preference retrieved: $enabled")
        promise.resolve(enabled)
    }
}
