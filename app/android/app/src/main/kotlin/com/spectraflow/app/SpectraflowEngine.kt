package com.spectraflow.app

object SpectraflowEngine {
    init {
        System.loadLibrary("spectraflow_core")
    }

    external fun nativeInit(): Boolean
    external fun nativeShutdown()
    external fun nativeStartMicrophone(): Boolean
    external fun nativeStartFilePlayback(filePath: String): Boolean
    external fun nativeStop()
    external fun nativeGetBpm(): Float
    external fun nativeGetEnergy(): Float
    external fun nativeGetStereoWidth(): Float
    external fun nativeGetFFTData(): FloatArray?
}
