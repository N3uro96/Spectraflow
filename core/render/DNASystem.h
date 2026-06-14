#pragma once
#include <cstdint>
#include <array>
#include "../Types.h"

class DNASystem {
public:
    DNASystem();

    // Generiert ShaderDNA aus einem Seed
    ShaderDNA generate(uint64_t seed, int shader_id);

    // Zufälliger Seed
    uint64_t random_seed();

    // Zwei DNAs sanft ineinander morphen (für Transitions)
    ShaderDNA morph(const ShaderDNA& a, const ShaderDNA& b, float t);

    // DNA auf Basis von AudioData leicht modulieren (pro Frame)
    void modulate(ShaderDNA& dna, const AudioData& audio);

private:
    // Pseudo-Random Number Generator (deterministisch, seed-basiert)
    // Gleicher Seed = immer gleiche DNA
    float next_float(uint64_t& state, float min, float max);
    float next_float_01(uint64_t& state);
    uint64_t hash(uint64_t seed, uint64_t salt);

    // Shader-spezifische Parameter-Ranges
    struct ParamRange {
        float min;
        float max;
    };

    // 16 Parameter pro Shader mit individuellen Ranges
    static constexpr size_t NUM_PARAMS = 16;
    std::array<ParamRange, NUM_PARAMS> param_ranges_;
};
