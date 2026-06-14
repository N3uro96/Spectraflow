#pragma once
#include <cstddef>
#include <atomic>
#include <memory>
#include "FFTAnalyzer.h"
#include "BPMDetector.h"
#include "SignalNormalizer.h"
#include "../render/RingBuffer.h"
#include "../Types.h"

class AudioEngine {
public:
    AudioEngine();
    ~AudioEngine();

    // Starten / Stoppen
    bool start();
    void stop();

    // Audio Buffer einspeisung (vom Platform Audio Thread)
    // left/right: separate Kanäle, num_samples: Samples pro Kanal
    void feed(const float* left, const float* right, size_t num_samples);

    // RingBuffer für Render Thread
    bool get_latest(AudioData& out);

    // Einstellungen
    void set_sample_rate(float sr);
    void set_attack(float ms);
    void set_release(float ms);

    // Status
    float get_bpm()          const { return current_bpm_;   }
    float get_stereo_width() const { return stereo_width_;  }
    float get_energy()       const { return energy_;        }
    bool  is_running()       const { return running_;       }

private:
    std::unique_ptr<FFTAnalyzer>      fft_;
    std::unique_ptr<BPMDetector>      bpm_;
    std::unique_ptr<SignalNormalizer> normalizer_;

    // Lock-free RingBuffer (64 Frames Puffer)
    RingBuffer<AudioData, 64> ring_buffer_;

    // Status
    std::atomic<bool>  running_      { false };
    std::atomic<float> current_bpm_  { 120.0f };
    std::atomic<float> stereo_width_ { 0.0f };
    std::atomic<float> energy_       { 0.0f };

    float sample_rate_ = 44100.0f;
};
