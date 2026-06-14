cmake_minimum_required(VERSION 3.28)
project(spectraflow_core)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(FetchContent)

# ─────────────────────────────────────────
# Oboe via FetchContent
# ─────────────────────────────────────────
FetchContent_Declare(
    oboe
    GIT_REPOSITORY https://github.com/google/oboe.git
    GIT_TAG        main
    GIT_SHALLOW    TRUE
)

# ─────────────────────────────────────────
# kissfft via FetchContent
# ─────────────────────────────────────────
FetchContent_Declare(
    kissfft
    GIT_REPOSITORY https://github.com/mborgerding/kissfft.git
    GIT_TAG        master
    GIT_SHALLOW    TRUE
)

set(KISSFFT_STATIC ON CACHE BOOL "" FORCE)
set(KISSFFT_TEST   OFF CACHE BOOL "" FORCE)
set(KISSFFT_TOOLS  OFF CACHE BOOL "" FORCE)

FetchContent_MakeAvailable(oboe kissfft)

# ─────────────────────────────────────────
# Core Sources
# ─────────────────────────────────────────
set(CORE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/../../../core)

add_library(spectraflow_core SHARED
    ${CORE_DIR}/audio/AudioEngine.cpp
    ${CORE_DIR}/audio/FFTAnalyzer.cpp
    ${CORE_DIR}/audio/BPMDetector.cpp
    ${CORE_DIR}/audio/SignalNormalizer.cpp
    ${CORE_DIR}/render/DNASystem.cpp
    ${CORE_DIR}/ai/AIBrain.cpp
    ${CORE_DIR}/spectraflow_ffi.cpp
    jni/SpectraflowJNI.cpp
)

target_include_directories(spectraflow_core PRIVATE
    ${CORE_DIR}
    ${oboe_SOURCE_DIR}/include
    ${kissfft_SOURCE_DIR}
)

target_link_libraries(spectraflow_core
    kissfft
    oboe
    android
    log
)
