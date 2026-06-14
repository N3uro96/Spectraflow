#include "FilePlayer.h"
#include <cstring>
#include <cmath>
#include <thread>
#include <chrono>
#include <android/log.h>

#define DR_MP3_IMPLEMENTATION
#define DR_WAV_IMPLEMENTATION
#define DR_FLAC_IMPLEMENTATION
#include "../deps/dr_mp3.h"
#include "../deps/dr_wav.h"
#include "../deps/dr_flac.h"

#define LOG_TAG "FilePlayer"
#define LOGI(...) __android_log_print(ANDROID_LOG_INFO,  LOG_TAG, __VA_ARGS__)
#define LOGE(...) __android_log_print(ANDROID_LOG_ERROR, LOG_TAG, __VA_ARGS__)

FilePlayer::FilePlayer() {}

FilePlayer::~FilePlayer() { stop(); }

bool FilePlayer::load(const std::string& path)
{
    stop();
    pcm_left_.clear();
    pcm_right_.clear();
    read_pos_ = 0;

    // Dateiendung prüfen
    std::string ext = path.substr(path.find_last_of('.') + 1);
    for (auto& c : ext) c = tolower(c);

    if (ext == "mp3") {
        drmp3 mp3;
        if (!drmp3_init_file(&mp3, path.c_str(), nullptr)) {
            LOGE("Failed to open MP3: %s", path.c_str());
            return false;
        }
        sample_rate_ = mp3.sampleRate;
        channels_    = mp3.channels;

        drmp3_uint64 frame_count = drmp3_get_pcm_frame_count(&mp3);
        std::vector<float> interleaved(frame_count * channels_);
        drmp3_read_pcm_frames_f32(&mp3, frame_count, interleaved.data());
        drmp3_uninit(&mp3);

        pcm_left_.resize(frame_count);
        pcm_right_.resize(frame_count);
        for (size_t i = 0; i < frame_count; i++) {
            pcm_left_[i]  = interleaved[i * channels_];
            pcm_right_[i] = (channels_ > 1) ? interleaved[i * channels_ + 1] : pcm_left_[i];
        }
    }
    else if (ext == "wav") {
        drwav wav;
        if (!drwav_init_file(&wav, path.c_str(), nullptr)) {
            LOGE("Failed to open WAV: %s", path.c_str());
            return false;
        }
        sample_rate_ = wav.sampleRate;
        channels_    = wav.channels;

        std::vector<float> interleaved(wav.totalPCMFrameCount * channels_);
        drwav_read_pcm_frames_f32(&wav, wav.totalPCMFrameCount, interleaved.data());
        drwav_uninit(&wav);

        pcm_left_.resize(wav.totalPCMFrameCount);
        pcm_right_.resize(wav.totalPCMFrameCount);
        for (size_t i = 0; i < wav.totalPCMFrameCount; i++) {
            pcm_left_[i]  = interleaved[i * channels_];
            pcm_right_[i] = (channels_ > 1) ? interleaved[i * channels_ + 1] : pcm_left_[i];
        }
    }
    else if (ext == "flac") {
        drflac* flac = drflac_open_file(path.c_str(), nullptr);
        if (!flac) {
            LOGE("Failed to open FLAC: %s", path.c_str());
            return false;
        }
        sample_rate_ = flac->sampleRate;
        channels_    = flac->channels;

        std::vector<float> interleaved(flac->totalPCMFrameCount * channels_);
        drflac_read_pcm_frames_f32(flac, flac->totalPCMFrameCount, interleaved.data());
        size_t total = flac->totalPCMFrameCount;
        drflac_close(flac);

        pcm_left_.resize(total);
        pcm_right_.resize(total);
        for (size_t i = 0; i < total; i++) {
            pcm_left_[i]  = interleaved[i * channels_];
            pcm_right_[i] = (channels_ > 1) ? interleaved[i * channels_ + 1] : pcm_left_[i];
        }
    }
    else {
        LOGE("Unsupported format: %s", ext.c_str());
        return false;
    }

    LOGI("Loaded %s: %zu frames, %d Hz, %d ch",
         path.c_str(), pcm_left_.size(), sample_rate_, channels_);
    return true;
}

void FilePlayer::play()
{
    if (pcm_left_.empty()) return;
    should_stop_.store(false);
    playing_.store(true);

    if (thread_.joinable()) thread_.join();
    thread_ = std::thread(&FilePlayer::decode_thread, this);
}

void FilePlayer::pause()
{
    playing_.store(false);
}

void FilePlayer::stop()
{
    should_stop_.store(true);
    playing_.store(false);
    if (thread_.joinable()) thread_.join();
    read_pos_ = 0;
}

float FilePlayer::get_position() const
{
    if (pcm_left_.empty()) return 0.0f;
    return static_cast<float>(read_pos_) / pcm_left_.size();
}

void FilePlayer::decode_thread()
{
    const size_t CHUNK = 1024;
    const float  frame_time_ms = (1000.0f * CHUNK) / sample_rate_;

    while (!should_stop_.load() && read_pos_ < pcm_left_.size()) {
        if (!playing_.load()) {
            std::this_thread::sleep_for(std::chrono::milliseconds(10));
            continue;
        }

        size_t frames = std::min(CHUNK, pcm_left_.size() - read_pos_);
        if (callback_) {
            callback_(pcm_left_.data()  + read_pos_,
                      pcm_right_.data() + read_pos_,
                      static_cast<int>(frames));
        }
        read_pos_ += frames;

        // Timing – damit wir nicht schneller als Echtzeit abspielen
        std::this_thread::sleep_for(
            std::chrono::microseconds(static_cast<int>(frame_time_ms * 1000)));
    }

    if (read_pos_ >= pcm_left_.size()) {
        read_pos_ = 0;
        playing_.store(false);
        LOGI("Playback finished");
    }
}
