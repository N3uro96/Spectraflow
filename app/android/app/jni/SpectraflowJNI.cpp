#include <jni.h>
#include <android/log.h>
#include <oboe/Oboe.h>
#include <memory>
#include <vector>
#include "audio/AudioEngine.h"
#include "spectraflow_ffi.h"

#define LOG_TAG "Spectraflow"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

class SpectraflowAudioCallback : public oboe::AudioStreamDataCallback {
public:
    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* stream,
        void* audioData,
        int32_t numFrames) override
    {
        auto* data    = static_cast<float*>(audioData);
        int   channels = stream->getChannelCount();

        if (channels >= 2) {
            std::vector<float> left(numFrames), right(numFrames);
            for (int i = 0; i < numFrames; i++) {
                left[i]  = data[i * 2];
                right[i] = data[i * 2 + 1];
            }
            sf_feed_audio(left.data(), right.data(), numFrames);
        } else {
            sf_feed_audio(data, data, numFrames);
        }
        return oboe::DataCallbackResult::Continue;
    }
};

static std::shared_ptr<oboe::AudioStream>        g_stream;
static std::unique_ptr<SpectraflowAudioCallback> g_callback;

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeInit(JNIEnv*, jobject)
{
    return sf_init() ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeShutdown(JNIEnv*, jobject)
{
    if (g_stream) { g_stream->stop(); g_stream->close(); g_stream.reset(); }
    sf_shutdown();
}

JNIEXPORT jboolean JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeStartMicrophone(JNIEnv*, jobject)
{
    g_callback = std::make_unique<SpectraflowAudioCallback>();

    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Input)
           ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
           ->setSharingMode(oboe::SharingMode::Exclusive)
           ->setFormat(oboe::AudioFormat::Float)
           ->setChannelCount(oboe::ChannelCount::Stereo)
           ->setSampleRate(44100)
           ->setDataCallback(g_callback.get());

    oboe::Result result = builder.openStream(g_stream);
    if (result != oboe::Result::OK) {
        LOGE("Failed to open mic: %s", oboe::convertToText(result));
        return JNI_FALSE;
    }

    sf_set_sample_rate(static_cast<float>(g_stream->getSampleRate()));
    result = g_stream->start();
    if (result != oboe::Result::OK) {
        LOGE("Failed to start mic: %s", oboe::convertToText(result));
        return JNI_FALSE;
    }

    LOGI("Mic started at %d Hz", g_stream->getSampleRate());
    return JNI_TRUE;
}

JNIEXPORT void JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeStop(JNIEnv*, jobject)
{
    if (g_stream) { g_stream->stop(); g_stream->close(); g_stream.reset(); }
}

JNIEXPORT jboolean JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeStartFilePlayback(
    JNIEnv*, jobject, jstring) { return JNI_FALSE; }

JNIEXPORT jfloat JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeGetBpm(JNIEnv*, jobject)
{ return static_cast<jfloat>(sf_get_bpm()); }

JNIEXPORT jfloat JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeGetEnergy(JNIEnv*, jobject)
{ return static_cast<jfloat>(sf_get_energy()); }

JNIEXPORT jfloat JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeGetStereoWidth(JNIEnv*, jobject)
{ return static_cast<jfloat>(sf_get_stereo_width()); }

JNIEXPORT jfloatArray JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeGetFFTData(JNIEnv* env, jobject)
{
    SF_AudioData data{};
    if (!sf_get_audio_data(&data)) return nullptr;

    jfloatArray result = env->NewFloatArray(192);
    if (!result) return nullptr;

    float combined[192];
    for (int i = 0; i < 32; i++) {
        combined[i +   0] = data.fft_left[i];
        combined[i +  32] = data.fft_right[i];
        combined[i +  64] = data.fft_mid[i];
        combined[i +  96] = data.fft_side[i];
        combined[i + 128] = data.env_left[i];
        combined[i + 160] = data.env_right[i];
    }
    env->SetFloatArrayRegion(result, 0, 192, combined);
    return result;
}

} // extern "C"
