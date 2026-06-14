#include "AudioEngine.h"
#include <cstring>

AudioEngine::AudioEngine()
    : fft_       (std::make_unique<FFTAnalyzer>())
    , bpm_       (std::make_unique<BPMDetector>())
    , normalizer_(std::make_unique<SignalNormalizer>())
{
}

AudioEngine::~AudioEngine()
{
    stop();
}

bool AudioEngine::start()
{
    running_.store(true);
    return true;
}

void AudioEngine::stop()
{
    running_.store(false);
}

void AudioEngine::feed(const float* left, const float* right, size_t num_samples)
{
    if (!running_.load()) return;

    AudioData data{};

    // 1. FFT Analyse (Stereo L/R + Mid/Side)
    fft_->process(left, right, num_samples, data);

    // 2. Signal Normalisierung (Auto-Gain + Peak Limiter)
    normalizer_->process(data);

    // 3. BPM + Beat Onset Detection
    float bpm        = 120.0f;
    bool  beat_onset = false;
    float beat_phase = 0.0f;
    bpm_->process(data, bpm, beat_onset, beat_phase);

    data.bpm        = bpm;
    data.beat_onset = beat_onset;
    data.beat_phase = beat_phase;

    // 4. Atomare Status-Updates (für Flutter FFI Abfragen)
    current_bpm_.store(bpm);
    stereo_width_.store(data.stereo_width);
    energy_.store(data.energy);

    // 5. In RingBuffer schreiben (Render Thread liest daraus)
    ring_buffer_.push(data);
}

bool AudioEngine::get_latest(AudioData& out)
{
    return ring_buffer_.peek_latest(out);
}

void AudioEngine::set_sample_rate(float sr)
{
    sample_rate_ = sr;
    bpm_->set_sample_rate(sr);
}

void AudioEngine::set_attack(float ms)
{
    fft_->set_attack(ms);
}

void AudioEngine::set_release(float ms)
{
    fft_->set_release(ms);
}
