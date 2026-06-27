package com.partyshare.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.database.ContentObserver
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.MediaStore
import android.util.Log
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.IOException

class CameraObserverService : Service() {

    companion object {
        const val TAG = "CameraObserver"
        const val CHANNEL_ID = "camera_observer_channel"
        const val NOTIFICATION_ID = 4782

        @JvmStatic
        var isRunning = false
            private set
    }

    private var eventId: String? = null
    private var backendUrl: String? = null
    private var startTimeMs: Long = 0
    private var lastProcessedPath: String? = null

    private val observerHandler = Handler(Looper.getMainLooper())
    private val imageObserver = object : ContentObserver(observerHandler) {
        override fun onChange(selfChange: Boolean, uri: Uri?) {
            super.onChange(selfChange, uri)
            Log.d(TAG, "ContentObserver triggered. Uri: $uri")
            checkLatestPhoto()
        }
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "Service onCreate called")
        isRunning = true
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        Log.d(TAG, "Service onStartCommand called")

        eventId = intent?.getStringExtra("eventId")
        backendUrl = intent?.getStringExtra("backendUrl")
        startTimeMs = intent?.getLongExtra("startTimeMs", System.currentTimeMillis()) ?: System.currentTimeMillis()

        Log.d(TAG, "Configured with Event ID: $eventId, Backend: $backendUrl, Start Time: $startTimeMs")

        createNotificationChannel()
        startServiceInForeground()

        // Register the MediaStore content observer
        contentResolver.registerContentObserver(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            true,
            imageObserver
        )

        return START_REDELIVER_INTENT
    }

    private fun checkLatestPhoto() {
        val projection = arrayOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DATA,
            MediaStore.Images.Media.DATE_ADDED
        )
        val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC"

        var cursor = try {
            contentResolver.query(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                sortOrder
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to query MediaStore", e)
            null
        }

        cursor?.use {
            if (it.moveToFirst()) {
                val dataIndex = it.getColumnIndex(MediaStore.Images.Media.DATA)
                val dateIndex = it.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)

                if (dataIndex != -1 && dateIndex != -1) {
                    val filePath = it.getString(dataIndex)
                    val dateAddedSeconds = it.getLong(dateIndex)
                    val dateAddedMs = dateAddedSeconds * 1000

                    Log.d(TAG, "Latest photo found: $filePath, added date ms: $dateAddedMs, start time: $startTimeMs")

                    // Only process files that exist and were added after the start time
                    if (dateAddedMs >= startTimeMs) {
                        if (filePath != lastProcessedPath) {
                            lastProcessedPath = filePath
                            Log.i(TAG, "New photo detected! Path: $filePath")

                            // 1. Notify React Native UI
                            emitPhotoDetectedEvent(filePath)

                            // 2. Perform HTTP Upload (stub for Phase 6)
                            uploadPhoto(filePath)
                        } else {
                            Log.d(TAG, "Duplicate trigger ignored for path: $filePath")
                        }
                    } else {
                        Log.d(TAG, "Detected photo was captured before event started. Ignoring.")
                    }
                }
            }
        }
    }

    private fun emitPhotoDetectedEvent(path: String) {
        val context = CameraMonitorModule.reactContext
        if (context != null && context.hasActiveReactInstance()) {
            try {
                val params = Arguments.createMap().apply {
                    putString("path", path)
                }
                context
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    .emit("onPhotoDetected", params)
                Log.d(TAG, "Emitted onPhotoDetected event to JS layer")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to emit event to JS", e)
            }
        } else {
            Log.d(TAG, "React context is not active; event not emitted to UI")
        }
    }

    private fun uploadPhoto(path: String) {
        val file = File(path)
        if (!file.exists()) {
            Log.e(TAG, "File does not exist at path: $path")
            return
        }

        val url = "$backendUrl/api/events/$eventId/photos"
        Log.i(TAG, "Initiating background photo upload to $url for file: ${file.name}")

        val mediaType = "image/jpeg".toMediaTypeOrNull()
        val fileBody = file.asRequestBody(mediaType)

        val requestBody = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("photo", file.name, fileBody)
            .build()

        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .build()

        val client = OkHttpClient()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Upload failed for file ${file.name}: ${e.message}", e)
            }

            override fun onResponse(call: Call, response: Response) {
                response.use {
                    if (!response.isSuccessful) {
                        Log.e(TAG, "Server rejected upload for file ${file.name}. Status code: ${response.code}")
                    } else {
                        Log.i(TAG, "Photo ${file.name} uploaded successfully! Server returned: ${response.body?.string()}")
                    }
                }
            }
        })
    }

    private fun startServiceInForeground() {
        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val notification: Notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Party Share")
            .setContentText("Camera live monitoring is active.")
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        Log.d(TAG, "Service started in foreground")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val name = "Camera Monitoring Channel"
            val descriptionText = "Monitors external storage for newly taken pictures."
            val importance = NotificationManager.IMPORTANCE_LOW
            val channel = NotificationChannel(CHANNEL_ID, name, importance).apply {
                description = descriptionText
            }
            val notificationManager: NotificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "Service onDestroy called")
        contentResolver.unregisterContentObserver(imageObserver)
        isRunning = false
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
}
