#include <jni.h>
#include <android/log.h>
#include <oboe/Oboe.h>
#include <memory>
#include <vector>
#include "audio/AudioEngine.h"
#include "audio/FilePlayer.h"
#include "spectraflow_ffi.h"

#define LOG_TAG "Spectraflow"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// ─────────────────────────────────────────
// Mikrofon Callback
// ─────────────────────────────────────────
class MicCallback : public oboe::AudioStreamDataCallback {
public:
    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* stream, void* data, int32_t frames) override
    {
        auto* f = static_cast<float*>(data);
        int   ch = stream->getChannelCount();
        if (ch >= 2) {
            std::vector<float> L(frames), R(frames);
            for (int i = 0; i < frames; i++) { L[i] = f[i*2]; R[i] = f[i*2+1]; }
            sf_feed_audio(L.data(), R.data(), frames);
        } else {
            sf_feed_audio(f, f, frames);
        }
        return oboe::DataCallbackResult::Continue;
    }
};

// ─────────────────────────────────────────
// Output Callback (File Playback)
// ─────────────────────────────────────────
class OutputCallback : public oboe::AudioStreamDataCallback {
public:
    std::vector<float> buffer_left;
    std::vector<float> buffer_right;
    size_t             read_pos = 0;
    bool               has_data = false;

    void feed(const float* L, const float* R, int frames) {
        buffer_left.assign(L, L + frames);
        buffer_right.assign(R, R + frames);
        read_pos = 0;
        has_data = true;
        sf_feed_audio(L, R, frames);  // FFT Analyse
    }

    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* stream, void* data, int32_t frames) override
    {
        auto* out = static_cast<float*>(data);
        int   ch  = stream->getChannelCount();
        for (int i = 0; i < frames; i++) {
            float l = (has_data && read_pos < buffer_left.size())
                      ? buffer_left[read_pos] : 0.0f;
            float r = (has_data && read_pos < buffer_right.size())
                      ? buffer_right[read_pos] : 0.0f;
            if (ch >= 2) { out[i*2] = l; out[i*2+1] = r; }
            else           out[i]   = (l + r) * 0.5f;
            read_pos++;
        }
        return oboe::DataCallbackResult::Continue;
    }
};

// ─────────────────────────────────────────
// Globale Instanzen
// ─────────────────────────────────────────
static std::shared_ptr<oboe::AudioStream> g_input_stream;
static std::shared_ptr<oboe::AudioStream> g_output_stream;
static std::unique_ptr<MicCallback>       g_mic_cb;
static std::unique_ptr<OutputCallback>    g_out_cb;
static std::unique_ptr<FilePlayer>        g_file_player;

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeInit(JNIEnv*, jobject)
{
    return sf_init() ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeShutdown(JNIEnv*, jobject)
{
    if (g_input_stream)  { g_input_stream->stop();  g_input_stream->close();  g_input_stream.reset(); }
    if (g_output_stream) { g_output_stream->stop(); g_output_stream->close(); g_output_stream.reset(); }
    if (g_file_player)   { g_file_player->stop(); g_file_player.reset(); }
    sf_shutdown();
}

JNIEXPORT jboolean JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeStartMicrophone(JNIEnv*, jobject)
{
    if (g_file_player) { g_file_player->stop(); }

    g_mic_cb = std::make_unique<MicCallback>();
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Input)
           ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
           ->setSharingMode(oboe::SharingMode::Exclusive)
           ->setFormat(oboe::AudioFormat::Float)
           ->setChannelCount(oboe::ChannelCount::Stereo)
           ->setSampleRate(44100)
           ->setDataCallback(g_mic_cb.get());

    oboe::Result r = builder.openStream(g_input_stream);
    if (r != oboe::Result::OK) { LOGE("Mic open failed: %s", oboe::convertToText(r)); return JNI_FALSE; }
    sf_set_sample_rate(g_input_stream->getSampleRate());
    r = g_input_stream->start();
    if (r != oboe::Result::OK) { LOGE("Mic start failed: %s", oboe::convertToText(r)); return JNI_FALSE; }
    LOGI("Mic started at %d Hz", g_input_stream->getSampleRate());
    return JNI_TRUE;
}

JNIEXPORT jboolean JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeStartFilePlayback(
    JNIEnv* env, jobject, jstring jpath)
{
    const char* path = env->GetStringUTFChars(jpath, nullptr);
    std::string file_path(path);
    env->ReleaseStringUTFChars(jpath, path);

    // Output Stream öffnen
    g_out_cb = std::make_unique<OutputCallback>();
    oboe::AudioStreamBuilder builder;
    builder.setDirection(oboe::Direction::Output)
           ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
           ->setSharingMode(oboe::SharingMode::Shared)
           ->setFormat(oboe::AudioFormat::Float)
           ->setChannelCount(oboe::ChannelCount::Stereo)
           ->setSampleRate(44100)
           ->setDataCallback(g_out_cb.get());

    oboe::Result r = builder.openStream(g_output_stream);
    if (r != oboe::Result::OK) { LOGE("Output open failed: %s", oboe::convertToText(r)); return JNI_FALSE; }
    sf_set_sample_rate(g_output_stream->getSampleRate());
    r = g_output_stream->start();
    if (r != oboe::Result::OK) { LOGE("Output start failed: %s", oboe::convertToText(r)); return JNI_FALSE; }

    // File Player starten
    g_file_player = std::make_unique<FilePlayer>();
    if (!g_file_player->load(file_path)) {
        LOGE("Failed to load file: %s", file_path.c_str());
        return JNI_FALSE;
    }

    // File Player → Output Callback
    g_file_player->set_callback([](const float* L, const float* R, int frames) {
        if (g_out_cb) g_out_cb->feed(L, R, frames);
    });

    g_file_player->play();
    LOGI("File playback started: %s", file_path.c_str());
    return JNI_TRUE;
}

JNIEXPORT void JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeStop(JNIEnv*, jobject)
{
    if (g_input_stream)  { g_input_stream->stop();  g_input_stream->close();  g_input_stream.reset(); }
    if (g_output_stream) { g_output_stream->stop(); g_output_stream->close(); g_output_stream.reset(); }
    if (g_file_player)   { g_file_player->stop(); }
}

JNIEXPORT jfloat JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeGetBpm(JNIEnv*, jobject)
{ return sf_get_bpm(); }

JNIEXPORT jfloat JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeGetEnergy(JNIEnv*, jobject)
{ return sf_get_energy(); }

JNIEXPORT jfloat JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeGetStereoWidth(JNIEnv*, jobject)
{ return sf_get_stereo_width(); }

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
