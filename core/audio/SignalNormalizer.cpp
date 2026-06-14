#include "SignalNormalizer.h"
#include <cmath>
#include <numeric>
#include <algorithm>

SignalNormalizer::SignalNormalizer()
{
    peak_left_.fill(0.0f);
    peak_right_.fill(0.0f);
    peak_mid_.fill(0.0f);
    peak_side_.fill(0.0f);
    rms_history_left_.fill(0.0f);
    rms_history_right_.fill(0.0f);
}

void SignalNormalizer::process(AudioData& data)
{
    float rms_left  = 0.0f;
    float rms_right = 0.0f;

    for (size_t i = 0; i < 32; i++) {
        rms_left  += data.fft_left[i]  * data.fft_left[i];
        rms_right += data.fft_right[i] * data.fft_right[i];
    }
    rms_left  = std::sqrt(rms_left  / 32.0f);
    rms_right = std::sqrt(rms_right / 32.0f);

    rms_history_left_[rms_index_]  = rms_left;
    rms_history_right_[rms_index_] = rms_right;
    rms_index_ = (rms_index_ + 1) % RMS_HISTORY;

    float avg_rms_left  = std::accumulate(rms_history_left_.begin(),
                                           rms_history_left_.end(), 0.0f) / RMS_HISTORY;
    float avg_rms_right = std::accumulate(rms_history_right_.begin(),
                                           rms_history_right_.end(), 0.0f) / RMS_HISTORY;

    if (avg_rms_left  > 1e-6f)
        gain_left_  = std::clamp(target_rms_ / avg_rms_left,  0.1f, max_gain_);
    if (avg_rms_right > 1e-6f)
        gain_right_ = std::clamp(target_rms_ / avg_rms_right, 0.1f, max_gain_);

    // .data() für std::array → float*
    update_gain(data.fft_left.data(),  peak_left_.data(),  &gain_left_,  32);
    update_gain(data.fft_right.data(), peak_right_.data(), &gain_right_, 32);
    update_gain(data.env_left.data(),  peak_left_.data(),  &gain_left_,  32);
    update_gain(data.env_right.data(), peak_right_.data(), &gain_right_, 32);

    for (size_t i = 0; i < 32; i++) {
        data.fft_mid[i]  = (data.fft_left[i] + data.fft_right[i]) * 0.5f;
        data.fft_side[i] = std::abs(data.fft_left[i] - data.fft_right[i]) * 0.5f;
    }

    float side_energy = 0.0f, mid_energy = 0.0f;
    for (size_t i = 0; i < 32; i++) {
        side_energy += data.fft_side[i];
        mid_energy  += data.fft_mid[i];
    }
    data.stereo_width = (mid_energy > 1e-6f)
        ? std::min(1.0f, side_energy / mid_energy) : 0.0f;

    data.bass_left = data.bass_right = 0.0f;
    data.mid_left  = data.mid_right  = 0.0f;
    data.high_left = data.high_right = 0.0f;

    for (int i = 0;  i < 8;  i++) { data.bass_left += data.env_left[i]; data.bass_right += data.env_right[i]; }
    for (int i = 8;  i < 20; i++) { data.mid_left  += data.env_left[i]; data.mid_right  += data.env_right[i]; }
    for (int i = 20; i < 32; i++) { data.high_left += data.env_left[i]; data.high_right += data.env_right[i]; }

    data.bass_left /= 8.0f;  data.bass_right /= 8.0f;
    data.mid_left  /= 12.0f; data.mid_right  /= 12.0f;
    data.high_left /= 12.0f; data.high_right /= 12.0f;

    data.energy = 0.0f;
    for (size_t i = 0; i < 32; i++)
        data.energy += data.env_left[i] + data.env_right[i];
    data.energy /= 64.0f;
}

void SignalNormalizer::update_gain(float* bands, float* peak_hold,
                                    float* gain, size_t count)
{
    for (size_t i = 0; i < count; i++) {
        float val = bands[i] * (*gain);
        if (val > peak_hold[i])
            peak_hold[i] = val * peak_attack_;
        else
            peak_hold[i] *= peak_release_;

        if (peak_hold[i] > 1.0f)
            val /= peak_hold[i];

        bands[i] = std::clamp(val, 0.0f, 1.0f);
    }
}
