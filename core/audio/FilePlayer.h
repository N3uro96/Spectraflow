#pragma once
#include <string>
#include <vector>
#include <atomic>
#include <thread>
#include <functional>

class FilePlayer {
public:
    using AudioCallback = std::function<void(const float*, const float*, int)>;

    FilePlayer();
    ~FilePlayer();

    bool load(const std::string& path);
    void play();
    void pause();
    void stop();
    bool is_playing() const { return playing_; }

    // Callback wenn neue Audio-Daten bereit sind
    void set_callback(AudioCallback cb) { callback_ = cb; }

    float get_position() const; // 0.0 - 1.0
    int   get_sample_rate() const { return sample_rate_; }

private:
    void decode_thread();

    std::vector<float> pcm_left_;
    std::vector<float> pcm_right_;
    size_t             read_pos_    = 0;
    int                sample_rate_ = 44100;
    int                channels_    = 2;

    std::atomic<bool>  playing_  { false };
    std::atomic<bool>  should_stop_ { false };

    std::thread        thread_;
    AudioCallback      callback_;
};
