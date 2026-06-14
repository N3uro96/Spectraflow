#include <jni.h>
#include <android/log.h>
#include <oboe/Oboe.h>
#include <memory>
#include <vector>
#include <atomic>
#include <cmath>
#include "audio/AudioEngine.h"
#include "spectraflow_ffi.h"

#define DR_MP3_IMPLEMENTATION
#define DR_WAV_IMPLEMENTATION
#define DR_FLAC_IMPLEMENTATION
#include "../deps/dr_mp3.h"
#include "../deps/dr_wav.h"
#include "../deps/dr_flac.h"

#define LOG_TAG "Spectraflow"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

// Debug Zähler
static std::atomic<int> g_feed_count{0};
static std::atomic<float> g_max_sample{0.0f};

class FilePlaybackCallback : public oboe::AudioStreamDataCallback {
public:
    std::vector<float>  pcm_left, pcm_right;
    std::atomic<size_t> read_pos{0};
    std::atomic<bool>   playing{false};

    static constexpr size_t CHUNK = 2048;
    float buf_l[CHUNK]{}, buf_r[CHUNK]{};
    size_t buf_pos = 0;

    bool load(const std::string& path) {
        pcm_left.clear(); pcm_right.clear(); read_pos = 0;
        std::string ext = path.substr(path.find_last_of('.') + 1);
        for (auto& c : ext) c = std::tolower(c);

        if (ext == "mp3") {
            drmp3 mp3;
            if (!drmp3_init_file(&mp3, path.c_str(), nullptr)) {
                LOGE("Failed to open MP3: %s", path.c_str());
                return false;
            }
            drmp3_uint64 frames = drmp3_get_pcm_frame_count(&mp3);
            int ch = mp3.channels;
            std::vector<float> buf(frames * ch);
            drmp3_read_pcm_frames_f32(&mp3, frames, buf.data());
            drmp3_uninit(&mp3);
            _split(buf, frames, ch);
        } else if (ext == "wav") {
            drwav wav;
            if (!drwav_init_file(&wav, path.c_str(), nullptr)) {
                LOGE("Failed to open WAV: %s", path.c_str());
                return false;
            }
            int ch = wav.channels; size_t frames = wav.totalPCMFrameCount;
            std::vector<float> buf(frames * ch);
            drwav_read_pcm_frames_f32(&wav, frames, buf.data());
            drwav_uninit(&wav);
            _split(buf, frames, ch);
        } else if (ext == "flac") {
            drflac* flac = drflac_open_file(path.c_str(), nullptr);
            if (!flac) { LOGE("Failed to open FLAC: %s", path.c_str()); return false; }
            int ch = flac->channels; size_t frames = flac->totalPCMFrameCount;
            std::vector<float> buf(frames * ch);
            drflac_read_pcm_frames_f32(flac, frames, buf.data());
            drflac_close(flac);
            _split(buf, frames, ch);
        } else { LOGE("Unsupported format: %s", ext.c_str()); return false; }

        LOGI("Loaded %zu frames, first sample L=%.4f R=%.4f",
             pcm_left.size(),
             pcm_left.empty()  ? 0.0f : pcm_left[1000],
             pcm_right.empty() ? 0.0f : pcm_right[1000]);
        return !pcm_left.empty();
    }

    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* stream, void* data, int32_t numFrames) override
    {
        auto*  out   = static_cast<float*>(data);
        int    ch    = stream->getChannelCount();
        size_t pos   = read_pos.load(std::memory_order_relaxed);
        size_t total = pcm_left.size();

        for (int i = 0; i < numFrames; i++) {
            float l = 0.0f, r = 0.0f;
            if (playing.load() && pos < total) {
                l = pcm_left[pos]; r = pcm_right[pos]; pos++;
            }
            if (ch >= 2) { out[i*2] = l; out[i*2+1] = r; }
            else           out[i]   = (l + r) * 0.5f;

            buf_l[buf_pos] = l;
            buf_r[buf_pos] = r;

            // Track max sample für Debug
            float abs_l = std::abs(l);
            float cur   = g_max_sample.load();
            if (abs_l > cur) g_max_sample.store(abs_l);

            buf_pos++;
            if (buf_pos >= CHUNK) {
                sf_feed_audio(buf_l, buf_r, (int)CHUNK);
                int count = ++g_feed_count;
                // Alle 100 Calls loggen
                if (count % 100 == 0) {
                    LOGI("sf_feed_audio called %d times, max_sample=%.4f, playing=%d",
                         count, g_max_sample.load(), (int)playing.load());
                    g_max_sample.store(0.0f);
                }
                buf_pos = 0;
            }
        }
        read_pos.store(pos, std::memory_order_relaxed);
        if (pos >= total && playing.load())
            read_pos.store(0, std::memory_order_relaxed);
        return oboe::DataCallbackResult::Continue;
    }

private:
    void _split(const std::vector<float>& buf, size_t frames, int ch) {
        pcm_left.resize(frames); pcm_right.resize(frames);
        for (size_t i = 0; i < frames; i++) {
            pcm_left[i]  = buf[i * ch];
            pcm_right[i] = (ch > 1) ? buf[i * ch + 1] : buf[i * ch];
        }
    }
};

class MicCallback : public oboe::AudioStreamDataCallback {
    static constexpr size_t CHUNK = 2048;
    float buf_l[CHUNK]{}, buf_r[CHUNK]{};
    size_t pos = 0;
public:
    oboe::DataCallbackResult onAudioReady(
        oboe::AudioStream* stream, void* data, int32_t frames) override
    {
        auto* f  = static_cast<float*>(data);
        int   ch = stream->getChannelCount();
        for (int i = 0; i < frames; i++) {
            buf_l[pos] = (ch >= 2) ? f[i*2]   : f[i];
            buf_r[pos] = (ch >= 2) ? f[i*2+1] : f[i];

            float abs_l = std::abs(buf_l[pos]);
            float cur   = g_max_sample.load();
            if (abs_l > cur) g_max_sample.store(abs_l);

            if (++pos >= CHUNK) {
                sf_feed_audio(buf_l, buf_r, (int)CHUNK);
                int count = ++g_feed_count;
                if (count % 100 == 0) {
                    LOGI("MIC sf_feed_audio called %d times, max_sample=%.4f",
                         count, g_max_sample.load());
                    g_max_sample.store(0.0f);
                }
                pos = 0;
            }
        }
        return oboe::DataCallbackResult::Continue;
    }
};

static std::shared_ptr<oboe::AudioStream>    g_input_stream;
static std::shared_ptr<oboe::AudioStream>    g_output_stream;
static std::unique_ptr<MicCallback>          g_mic_cb;
static std::unique_ptr<FilePlaybackCallback> g_file_cb;

static void stop_streams() {
    if (g_input_stream)  { g_input_stream->stop();  g_input_stream->close();  g_input_stream.reset(); }
    if (g_output_stream) { g_output_stream->stop(); g_output_stream->close(); g_output_stream.reset(); }
}

extern "C" {

JNIEXPORT jboolean JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeInit(JNIEnv*, jobject)
{
    g_feed_count.store(0);
    g_max_sample.store(0.0f);
    LOGI("nativeInit called");
    return sf_init() ? JNI_TRUE : JNI_FALSE;
}

JNIEXPORT void JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeShutdown(JNIEnv*, jobject)
{ stop_streams(); sf_shutdown(); }

JNIEXPORT jboolean JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeStartMicrophone(JNIEnv*, jobject)
{
    stop_streams();
    g_feed_count.store(0);
    LOGI("Starting microphone...");
    g_mic_cb = std::make_unique<MicCallback>();
    oboe::AudioStreamBuilder b;
    b.setDirection(oboe::Direction::Input)
     ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
     ->setSharingMode(oboe::SharingMode::Exclusive)
     ->setFormat(oboe::AudioFormat::Float)
     ->setChannelCount(oboe::ChannelCount::Stereo)
     ->setSampleRate(44100)
     ->setDataCallback(g_mic_cb.get());
    auto r = b.openStream(g_input_stream);
    if (r != oboe::Result::OK) { LOGE("Mic open failed: %s", oboe::convertToText(r)); return JNI_FALSE; }
    sf_set_sample_rate((float)g_input_stream->getSampleRate());
    r = g_input_stream->start();
    if (r != oboe::Result::OK) { LOGE("Mic start failed: %s", oboe::convertToText(r)); return JNI_FALSE; }
    LOGI("Mic started at %d Hz, channels=%d",
         g_input_stream->getSampleRate(), g_input_stream->getChannelCount());
    return JNI_TRUE;
}

JNIEXPORT jboolean JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeStartFilePlayback(
    JNIEnv* env, jobject, jstring jpath)
{
    stop_streams();
    g_feed_count.store(0);
    const char* path = env->GetStringUTFChars(jpath, nullptr);
    std::string fp(path);
    env->ReleaseStringUTFChars(jpath, path);

    LOGI("Loading file: %s", fp.c_str());
    g_file_cb = std::make_unique<FilePlaybackCallback>();
    if (!g_file_cb->load(fp)) { LOGE("Load failed"); return JNI_FALSE; }

    oboe::AudioStreamBuilder b;
    b.setDirection(oboe::Direction::Output)
     ->setPerformanceMode(oboe::PerformanceMode::LowLatency)
     ->setSharingMode(oboe::SharingMode::Shared)
     ->setFormat(oboe::AudioFormat::Float)
     ->setChannelCount(oboe::ChannelCount::Stereo)
     ->setSampleRate(44100)
     ->setDataCallback(g_file_cb.get());
    auto r = b.openStream(g_output_stream);
    if (r != oboe::Result::OK) { LOGE("Output open: %s", oboe::convertToText(r)); return JNI_FALSE; }
    sf_set_sample_rate((float)g_output_stream->getSampleRate());
    r = g_output_stream->start();
    if (r != oboe::Result::OK) { LOGE("Output start: %s", oboe::convertToText(r)); return JNI_FALSE; }
    g_file_cb->playing.store(true);
    LOGI("File playback started");
    return JNI_TRUE;
}

JNIEXPORT void JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeStop(JNIEnv*, jobject)
{
    LOGI("nativeStop: total feed calls=%d", g_feed_count.load());
    if (g_file_cb) g_file_cb->playing.store(false);
    stop_streams();
}

JNIEXPORT jfloatArray JNICALL
Java_com_spectraflow_app_SpectraflowEngine_nativeGetAllData(JNIEnv* env, jobject)
{
    SF_AudioData data{};
    if (!sf_get_audio_data(&data)) return nullptr;
    jfloatArray result = env->NewFloatArray(195);
    if (!result) return nullptr;
    float combined[195];
    for (int i = 0; i < 32; i++) {
        combined[i +   0] = data.fft_left[i];
        combined[i +  32] = data.fft_right[i];
        combined[i +  64] = data.fft_mid[i];
        combined[i +  96] = data.fft_side[i];
        combined[i + 128] = data.env_left[i];
        combined[i + 160] = data.env_right[i];
    }
    combined[192] = sf_get_bpm();
    combined[193] = sf_get_energy();
    combined[194] = sf_get_stereo_width();
    env->SetFloatArrayRegion(result, 0, 195, combined);
    return result;
}

} // extern "C"
