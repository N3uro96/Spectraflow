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
                    "init" -> {
                        val ok = SpectraflowEngine.nativeInit()
                        result.success(ok)
                    }
                    "startMicrophone" -> {
                        val ok = SpectraflowEngine.nativeStartMicrophone()
                        result.success(ok)
                    }
                    "startFilePlayback" -> {
                        val path = call.argument<String>("path") ?: ""
                        val ok = SpectraflowEngine.nativeStartFilePlayback(path)
                        result.success(ok)
                    }
                    "stop" -> {
                        SpectraflowEngine.nativeStop()
                        result.success(null)
                    }
                    "getBpm" -> {
                        result.success(SpectraflowEngine.nativeGetBpm())
                    }
                    "getFFTData" -> {
                        val data = SpectraflowEngine.nativeGetFFTData()
                        result.success(data?.toList())
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
