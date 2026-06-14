#include "FFTAnalyzer.h"
#include <cmath>
#include <algorithm>

FFTAnalyzer::FFTAnalyzer()
    : attack_(5.0f)
    , decay_(10.0f)
    , release_(150.0f)
{
    prev_env_left_.fill(0.0f);
    prev_env_right_.fill(0.0f);
}

FFTAnalyzer::~FFTAnalyzer() {}

void FFTAnalyzer::process(const float* left, const float* right,
                           size_t num_samples, AudioData& out)
{
    // FFT pro Kanal
    compute_fft(left,  num_samples, out.fft_left);
    compute_fft(right, num_samples, out.fft_right);

    // Mid/Side berechnen
    compute_mid_side(out);

    // ADSR Envelopes
    apply_adsr(out.env_left,  out.fft_left,  32);
    apply_adsr(out.env_right, out.fft_right, 32);

    // Stereo Breite (RMS der Side-Bänder)
    float side_energy = 0.0f;
    float mid_energy  = 0.0f;
    for (int i = 0; i < 32; i++) {
        side_energy += out.fft_side[i];
        mid_energy  += out.fft_mid[i];
    }
    out.stereo_width = (mid_energy > 0.0f)
        ? std::min(1.0f, side_energy / (mid_energy + 1e-6f))
        : 0.0f;

    // Energie-Bänder (Bass 0-7, Mid 8-19, High 20-31)
    out.bass_left  = out.env_left[0]  + out.env_left[1]  + out.env_left[2]  + out.env_left[3];
    out.bass_right = out.env_right[0] + out.env_right[1] + out.env_right[2] + out.env_right[3];
    out.mid_left   = 0.0f;
    out.mid_right  = 0.0f;
    out.high_left  = 0.0f;
    out.high_right = 0.0f;

    for (int i = 8; i < 20; i++) {
        out.mid_left  += out.env_left[i];
        out.mid_right += out.env_right[i];
    }
    for (int i = 20; i < 32; i++) {
        out.high_left  += out.env_left[i];
        out.high_right += out.env_right[i];
    }

    // Gesamtenergie
    out.energy = 0.0f;
    for (int i = 0; i < 32; i++)
        out.energy += out.env_left[i] + out.env_right[i];
    out.energy /= 64.0f;
}

void FFTAnalyzer::compute_fft(const float* samples, size_t num_samples, float* bands_out)
{
    // Vereinfachte Band-Energie Berechnung
    // In der finalen Version: kissfft oder pffft einbinden
    size_t band_size = num_samples / 32;
    for (int b = 0; b < 32; b++) {
        float energy = 0.0f;
        size_t start = b * band_size;
        size_t end   = start + band_size;
        for (size_t i = start; i < end && i < num_samples; i++)
            energy += samples[i] * samples[i];
        bands_out[b] = std::sqrt(energy / band_size);
    }
}

void FFTAnalyzer::compute_mid_side(AudioData& data)
{
    for (int i = 0; i < 32; i++) {
        data.fft_mid[i]  = (data.fft_left[i] + data.fft_right[i]) * 0.5f;
        data.fft_side[i] = std::abs(data.fft_left[i] - data.fft_right[i]) * 0.5f;
    }
}

void FFTAnalyzer::apply_adsr(float* envelope, const float* bands, size_t count)
{
    // Attack: schnell hochfahren
    // Release: langsam abfallen → erzeugt den "fließenden" Spectraflow-Look
    const float attack_coeff  = 1.0f - std::exp(-1.0f / (attack_  * 0.001f * 44100.0f));
    const float release_coeff = 1.0f - std::exp(-1.0f / (release_ * 0.001f * 44100.0f));

    for (size_t i = 0; i < count; i++) {
        float prev = (envelope == nullptr) ? 0.0f : envelope[i];
        if (bands[i] > prev)
            envelope[i] = prev + attack_coeff  * (bands[i] - prev);
        else
            envelope[i] = prev + release_coeff * (bands[i] - prev);
    }
}
