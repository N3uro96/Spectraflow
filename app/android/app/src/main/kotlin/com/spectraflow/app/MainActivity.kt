package com.spectraflow.app

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel
import kotlinx.coroutines.*

class MainActivity : FlutterActivity() {
    private val METHOD_CHANNEL = "com.spectraflow.app/engine"
    private val EVENT_CHANNEL  = "com.spectraflow.app/audio_data"

    private var eventSink: EventChannel.EventSink? = null
    private var streamJob: Job? = null
    private val scope = CoroutineScope(Dispatchers.IO)

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // ── Method Channel (Steuerung) ──
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, METHOD_CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "init"              -> result.success(SpectraflowEngine.nativeInit())
                    "startMicrophone"   -> result.success(SpectraflowEngine.nativeStartMicrophone())
                    "startFilePlayback" -> {
                        val path = call.argument<String>("path") ?: ""
                        result.success(SpectraflowEngine.nativeStartFilePlayback(path))
                    }
                    "stop"              -> { SpectraflowEngine.nativeStop(); result.success(null) }
                    else                -> result.notImplemented()
                }
            }

        // ── Event Channel (Audio Daten Stream) ──
        EventChannel(flutterEngine.dartExecutor.binaryMessenger, EVENT_CHANNEL)
            .setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(args: Any?, sink: EventChannel.EventSink?) {
                    eventSink = sink
                    startStreaming()
                }
                override fun onCancel(args: Any?) {
                    stopStreaming()
                    eventSink = null
                }
            })
    }

    private fun startStreaming() {
        streamJob?.cancel()
        streamJob = scope.launch {
            while (isActive) {
                val data = SpectraflowEngine.nativeGetAllData()
                if (data != null) {
                    withContext(Dispatchers.Main) {
                        eventSink?.success(data.toList())
                    }
                }
                delay(33) // ~30fps
            }
        }
    }

    private fun stopStreaming() {
        streamJob?.cancel()
        streamJob = null
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
