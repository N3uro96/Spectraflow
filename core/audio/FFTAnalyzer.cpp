#include "FFTAnalyzer.h"
#include <cmath>
#include <algorithm>

static constexpr float PI = 3.14159265358979323846f;

FFTAnalyzer::FFTAnalyzer()
{
    cfg_ = kiss_fft_alloc(FFT_SIZE, 0, nullptr, nullptr);
    for (size_t i = 0; i < FFT_SIZE; i++)
        hanning_window_[i] = 0.5f * (1.0f - std::cos(2.0f * PI * i / (FFT_SIZE - 1)));
    build_log_bands();
    prev_env_left_.fill(0.0f);
    prev_env_right_.fill(0.0f);
}

FFTAnalyzer::~FFTAnalyzer()
{
    kiss_fft_free(cfg_);
}

void FFTAnalyzer::build_log_bands()
{
    const float log_min  = std::log10(20.0f);
    const float log_max  = std::log10(20000.0f);
    const float log_step = (log_max - log_min) / NUM_BANDS;
    for (size_t b = 0; b <= NUM_BANDS; b++) {
        float freq = std::pow(10.0f, log_min + b * log_step);
        int   bin  = static_cast<int>(freq * FFT_SIZE / sample_rate_);
        band_limits_[b] = std::clamp(bin, 0, static_cast<int>(FFT_SIZE / 2));
    }
}

void FFTAnalyzer::process(const float* left, const float* right,
                           size_t num_samples, AudioData& out)
{
    compute_fft(left,  out.fft_left.data());
    compute_fft(right, out.fft_right.data());
    compute_mid_side(out);
    apply_envelope(out.env_left.data(),  out.fft_left.data(),  attack_ms_, release_ms_);
    apply_envelope(out.env_right.data(), out.fft_right.data(), attack_ms_, release_ms_);

    float side_energy = 0.0f, mid_energy = 0.0f;
    for (size_t i = 0; i < NUM_BANDS; i++) {
        side_energy += out.fft_side[i];
        mid_energy  += out.fft_mid[i];
    }
    out.stereo_width = (mid_energy > 1e-6f)
        ? std::min(1.0f, side_energy / mid_energy) : 0.0f;

    out.bass_left = out.bass_right = 0.0f;
    out.mid_left  = out.mid_right  = 0.0f;
    out.high_left = out.high_right = 0.0f;

    for (int i = 0;  i < 8;  i++) { out.bass_left += out.env_left[i];  out.bass_right += out.env_right[i]; }
    for (int i = 8;  i < 20; i++) { out.mid_left  += out.env_left[i];  out.mid_right  += out.env_right[i]; }
    for (int i = 20; i < 32; i++) { out.high_left += out.env_left[i];  out.high_right += out.env_right[i]; }

    out.bass_left /= 8.0f;  out.bass_right /= 8.0f;
    out.mid_left  /= 12.0f; out.mid_right  /= 12.0f;
    out.high_left /= 12.0f; out.high_right /= 12.0f;

    out.energy = 0.0f;
    for (size_t i = 0; i < NUM_BANDS; i++)
        out.energy += out.env_left[i] + out.env_right[i];
    out.energy /= (NUM_BANDS * 2.0f);
}

void FFTAnalyzer::compute_fft(const float* samples, float* bands_out)
{
    std::vector<kiss_fft_cpx> in_buf(FFT_SIZE);
    std::vector<kiss_fft_cpx> out_buf(FFT_SIZE);

    for (size_t i = 0; i < FFT_SIZE; i++) {
        in_buf[i].r = samples[i] * hanning_window_[i];
        in_buf[i].i = 0.0f;
    }
    kiss_fft(cfg_, in_buf.data(), out_buf.data());

    // ── Pass 1: Rohe Band-Energie berechnen ──
    float raw[NUM_BANDS];
    float peak = 1e-6f;

    for (size_t b = 0; b < NUM_BANDS; b++) {
        int   start  = band_limits_[b];
        int   end    = std::max(start + 1, band_limits_[b + 1]);
        float energy = 0.0f;
        int   count  = 0;

        for (int bin = start; bin < end && bin < (int)(FFT_SIZE / 2); bin++) {
            float r  = out_buf[bin].r;
            float im = out_buf[bin].i;
            energy += std::sqrt(r * r + im * im);
            count++;
        }

        raw[b] = (count > 0) ? energy / (float)count : 0.0f;
        if (raw[b] > peak) peak = raw[b];
    }

    // ── Auto-Gain: Peak tracken ──
    // Wähle den richtigen Peak-Tracker basierend auf Kanal
    // (beide Kanäle teilen den Peak-Tracker hier, wird in process() getrennt)
    float& peak_tracker = (bands_out == nullptr) ? peak_left_ : peak_left_;

    // Fast Attack: sofort auf hohen Peak reagieren
    if (peak > peak_tracker) {
        peak_tracker = peak;
    } else {
        // Slow Release: langsam abfallen (ca. 3 Sekunden)
        peak_tracker = peak_tracker * 0.998f + peak * 0.002f;
    }
    peak_tracker = std::max(peak_tracker, 1e-6f);

    // ── Pass 2: Normalisieren ──
    // 0.8f damit die Balken nicht immer auf Maximum klemmen
    for (size_t b = 0; b < NUM_BANDS; b++) {
        bands_out[b] = std::min(1.0f, (raw[b] / peak_tracker) * 0.85f);
    }
}

void FFTAnalyzer::compute_mid_side(AudioData& data)
{
    for (size_t i = 0; i < NUM_BANDS; i++) {
        data.fft_mid[i]  = (data.fft_left[i] + data.fft_right[i]) * 0.5f;
        data.fft_side[i] = std::abs(data.fft_left[i] - data.fft_right[i]) * 0.5f;
    }
}

void FFTAnalyzer::apply_envelope(float* envelope, const float* bands,
                                  float attack_ms, float release_ms)
{
    const float ac = 1.0f - std::exp(-1.0f / (attack_ms  * 0.001f * sample_rate_));
    const float rc = 1.0f - std::exp(-1.0f / (release_ms * 0.001f * sample_rate_));
    for (size_t i = 0; i < NUM_BANDS; i++) {
        float prev  = envelope[i];
        envelope[i] = prev + (bands[i] > prev ? ac : rc) * (bands[i] - prev);
    }
}
