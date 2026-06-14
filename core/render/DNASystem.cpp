#include "DNASystem.h"
#include <cmath>
#include <ctime>

DNASystem::DNASystem()
{
    // Parameter Ranges – was jeder der 16 Parameter steuert
    // Entspricht Milkdrop per-vertex / per-pixel Gleichungen
    param_ranges_ = {{
        { 0.5f,  2.0f  },   //  0: zoom          (Zoom-Faktor)
        { -1.0f, 1.0f  },   //  1: rotation      (Rotationsgeschwindigkeit)
        { -0.3f, 0.3f  },   //  2: warp_x        (Horizontale Verzerrung)
        { -0.3f, 0.3f  },   //  3: warp_y        (Vertikale Verzerrung)
        { -0.1f, 0.1f  },   //  4: dx            (Pixel-Flow X)
        { -0.1f, 0.1f  },   //  5: dy            (Pixel-Flow Y)
        { 0.0f,  1.0f  },   //  6: wave_scale    (Wellen-Amplitude)
        { 0.5f,  8.0f  },   //  7: wave_freq     (Wellen-Frequenz)
        { 0.0f,  2.0f  },   //  8: feedback      (Feedback-Stärke)
        { 0.0f,  1.0f  },   //  9: color_speed   (Farb-Animationsgeschwindigkeit)
        { 1.0f,  6.0f  },   // 10: symmetry      (Symmetrie-Achsen)
        { 0.0f,  1.0f  },   // 11: bass_react    (Bass-Reaktivität)
        { 0.0f,  1.0f  },   // 12: mid_react     (Mid-Reaktivität)
        { 0.0f,  1.0f  },   // 13: high_react    (High-Reaktivität)
        { 0.0f,  3.14f },   // 14: phase_offset  (Phase-Versatz)
        { 0.1f,  2.0f  },   // 15: time_scale    (Zeitskala der Animation)
    }};
}

uint64_t DNASystem::hash(uint64_t seed, uint64_t salt)
{
    // xxHash-inspirierter Hash – schnell und gute Verteilung
    uint64_t h = seed ^ salt;
    h ^= h >> 33;
    h *= 0xff51afd7ed558ccdULL;
    h ^= h >> 33;
    h *= 0xc4ceb9fe1a85ec53ULL;
    h ^= h >> 33;
    return h;
}

float DNASystem::next_float_01(uint64_t& state)
{
    state = hash(state, 0x9e3779b97f4a7c15ULL);
    return static_cast<float>(state & 0xFFFFFF) / static_cast<float>(0xFFFFFF);
}

float DNASystem::next_float(uint64_t& state, float min, float max)
{
    return min + next_float_01(state) * (max - min);
}

uint64_t DNASystem::random_seed()
{
    // Zeit + Counter für einzigartigen Seed
    static uint64_t counter = 0;
    return hash(static_cast<uint64_t>(std::time(nullptr)), ++counter);
}

ShaderDNA DNASystem::generate(uint64_t seed, int shader_id)
{
    ShaderDNA dna{};
    dna.seed = seed;

    // Shader ID als Salt – gleicher Seed, anderer Shader = andere DNA
    uint64_t state = hash(seed, static_cast<uint64_t>(shader_id));

    // Alle 16 Parameter in einem Durchgang generieren
    for (size_t i = 0; i < 16; i++) {
        dna.params[i] = next_float(state, param_ranges_[i].min, param_ranges_[i].max);
    }

    // Benannte Felder sind Aliase der params-Einträge — kein doppelter PRNG-Verbrauch
    dna.zoom     = dna.params[0];
    dna.rotation = dna.params[1];
    dna.warp_x   = dna.params[2];
    dna.warp_y   = dna.params[3];
    dna.dx       = dna.params[4];
    dna.dy       = dna.params[5];

    return dna;
}

ShaderDNA DNASystem::morph(const ShaderDNA& a, const ShaderDNA& b, float t)
{
    // Sanftes Morphen zwischen zwei DNAs
    // t = 0.0 → komplett A, t = 1.0 → komplett B
    // Smooth-Step für organisches Gefühl
    float s = t * t * (3.0f - 2.0f * t);

    ShaderDNA result{};
    result.seed     = (t < 0.5f) ? a.seed : b.seed;
    result.zoom     = a.zoom     + s * (b.zoom     - a.zoom);
    result.rotation = a.rotation + s * (b.rotation - a.rotation);
    result.warp_x   = a.warp_x   + s * (b.warp_x   - a.warp_x);
    result.warp_y   = a.warp_y   + s * (b.warp_y   - a.warp_y);
    result.dx       = a.dx       + s * (b.dx       - a.dx);
    result.dy       = a.dy       + s * (b.dy       - a.dy);

    for (size_t i = 0; i < 16; i++)
        result.params[i] = a.params[i] + s * (b.params[i] - a.params[i]);

    return result;
}

void DNASystem::modulate(ShaderDNA& dna, const AudioData& audio)
{
    // Pro Frame: Audio moduliert die DNA leicht
    // Kein komplettes Überschreiben – nur subtile Reaktion

    float bass  = (audio.bass_left  + audio.bass_right)  * 0.5f;
    float mid   = (audio.mid_left   + audio.mid_right)   * 0.5f;
    float high  = (audio.high_left  + audio.high_right)  * 0.5f;

    // Bass → Zoom pulsiert leicht
    dna.zoom     += bass  * dna.params[11] * 0.3f;

    // Mid → Rotation beschleunigt
    dna.rotation += mid   * dna.params[12] * 0.1f;

    // High → Warp zittert
    dna.warp_x   += high  * dna.params[13] * 0.05f;
    dna.warp_y   -= high  * dna.params[13] * 0.05f;

    // Beat Onset → kurzer Impuls auf alle Parameter
    if (audio.beat_onset) {
        dna.zoom     *= 1.0f + dna.params[11] * 0.2f;
        dna.warp_x   *= 1.0f + dna.params[12] * 0.1f;
    }
}
