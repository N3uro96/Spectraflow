#include "FFTAnalyzer.h"
#include "../kissfft/kiss_fft.c"
#include <cmath>
#include <algorithm>

static constexpr float PI = 3.14159265358979323846f;

FFTAnalyzer::FFTAnalyzer()
{
    // kissfft initialisieren
    cfg_ = kiss_fft_alloc(FFT_SIZE, 0, nullptr, nullptr);

    // Hanning Fenster berechnen
    // Reduziert Spectral Leakage an den Rändern des Buffers
    for (size_t i = 0; i < FFT_SIZE; i++) {
        hanning_window_[i] = 0.5f * (1.0f - std::cos(2.0f * PI * i / (FFT_SIZE - 1)));
    }

    // Logarithmische Band-Grenzen aufbauen
    build_log_bands();

    // Envelopes auf 0 initialisieren
    prev_env_left_.fill(0.0f);
    prev_env_right_.fill(0.0f);
}

FFTAnalyzer::~FFTAnalyzer()
{
    kiss_fft_free(cfg_);
}

void FFTAnalyzer::build_log_bands()
{
    // Logarithmische Verteilung von 20Hz bis 20kHz
    // Entspricht menschlicher Wahrnehmung
    const float f_min    = 20.0f;
    const float f_max    = 20000.0f;
    const float log_min  = std::log10(f_min);
    const float log_max  = std::log10(f_max);
    const float log_step = (log_max - log_min) / NUM_BANDS;

    for (size_t b = 0; b <= NUM_BANDS; b++) {
        float freq      = std::pow(10.0f, log_min + b * log_step);
        int   bin_index = static_cast<int>(freq * FFT_SIZE / sample_rate_);
        bin_index       = std::clamp(bin_index, 0, static_cast<int>(FFT_SIZE / 2));
        band_limits_[b] = bin_index;
    }
}

void FFTAnalyzer::process(const float* left, const float* right,
                           size_t num_samples, AudioData& out)
{
    // Echte FFT pro Kanal
    compute_fft(left,  out.fft_left);
    compute_fft(right, out.fft_right);

    // Mid/Side
    compute_mid_side(out);

    // ADSR Envelopes
    apply_envelope(out.env_left,  out.fft_left,  attack_ms_, release_ms_);
    apply_envelope(out.env_right, out.fft_right, attack_ms_, release_ms_);

    // Stereo Breite
    float side_energy = 0.0f;
    float mid_energy  = 0.0f;
    for (size_t i = 0; i < NUM_BANDS; i++) {
        side_energy += out.fft_side[i];
        mid_energy  += out.fft_mid[i];
    }
    out.stereo_width = (mid_energy > 1e-6f)
        ? std::min(1.0f, side_energy / mid_energy)
        : 0.0f;

    // Energie-Bänder
    // Bass:  Bänder 0-7   (~20Hz  - ~300Hz)
    // Mid:   Bänder 8-19  (~300Hz - ~5kHz)
    // High:  Bänder 20-31 (~5kHz  - ~20kHz)
    out.bass_left  = 0.0f; out.bass_right  = 0.0f;
    out.mid_left   = 0.0f; out.mid_right   = 0.0f;
    out.high_left  = 0.0f; out.high_right  = 0.0f;

    for (int i = 0; i < 8;  i++) {
        out.bass_left  += out.env_left[i];
        out.bass_right += out.env_right[i];
    }
    for (int i = 8; i < 20; i++) {
        out.mid_left   += out.env_left[i];
        out.mid_right  += out.env_right[i];
    }
    for (int i = 20; i < 32; i++) {
        out.high_left  += out.env_left[i];
        out.high_right += out.env_right[i];
    }

    // Normalisieren
    out.bass_left  /= 8.0f;  out.bass_right  /= 8.0f;
    out.mid_left   /= 12.0f; out.mid_right   /= 12.0f;
    out.high_left  /= 12.0f; out.high_right  /= 12.0f;

    // Gesamtenergie
    out.energy = 0.0f;
    for (size_t i = 0; i < NUM_BANDS; i++)
        out.energy += out.env_left[i] + out.env_right[i];
    out.energy /= (NUM_BANDS * 2.0f);
}

void FFTAnalyzer::compute_fft(const float* samples, float* bands_out)
{
    // Input Buffer mit Hanning Fenster
    std::vector<kiss_fft_cpx> in_buf(FFT_SIZE);
    std::vector<kiss_fft_cpx> out_buf(FFT_SIZE);

    for (size_t i = 0; i < FFT_SIZE; i++) {
        in_buf[i].r = samples[i] * hanning_window_[i];
        in_buf[i].i = 0.0f;
    }

    // FFT ausführen
    kiss_fft(cfg_, in_buf.data(), out_buf.data());

    // Magnitude pro logarithmischem Band berechnen
    for (size_t b = 0; b < NUM_BANDS; b++) {
        int   bin_start = band_limits_[b];
        int   bin_end   = band_limits_[b + 1];
        float energy    = 0.0f;
        int   count     = 0;

        for (int bin = bin_start; bin < bin_end; bin++) {
            float real = out_buf[bin].r;
            float imag = out_buf[bin].i;
            energy += std::sqrt(real * real + imag * imag);
            count++;
        }

        // Normalisieren
        bands_out[b] = (count > 0)
            ? std::min(1.0f, (energy / count) / (FFT_SIZE * 0.5f))
            : 0.0f;
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
    // Attack:  schnell hochfahren  → sofortige Reaktion auf Kick/Snare
    // Release: langsam abfallen   → fließender Spectraflow-Look
    const float attack_coeff  = 1.0f - std::exp(-1.0f / (attack_ms  * 0.001f * sample_rate_));
    const float release_coeff = 1.0f - std::exp(-1.0f / (release_ms * 0.001f * sample_rate_));

    for (size_t i = 0; i < NUM_BANDS; i++) {
        float prev = envelope[i];
        if (bands[i] > prev)
            envelope[i] = prev + attack_coeff  * (bands[i] - prev);
        else
            envelope[i] = prev + release_coeff * (bands[i] - prev);
    }
}
