package com.spectraflow.app

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.spectraflow.app/engine"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "init"               -> result.success(SpectraflowEngine.nativeInit())
                    "startMicrophone"    -> result.success(SpectraflowEngine.nativeStartMicrophone())
                    "startFilePlayback"  -> {
                        val path = call.argument<String>("path") ?: ""
                        result.success(SpectraflowEngine.nativeStartFilePlayback(path))
                    }
                    "stop"               -> { SpectraflowEngine.nativeStop(); result.success(null) }
                    "getAllData"          -> result.success(SpectraflowEngine.nativeGetAllData()?.toList())
                    else                 -> result.notImplemented()
                }
            }
    }
}
