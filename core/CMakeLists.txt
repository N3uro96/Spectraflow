cmake_minimum_required(VERSION 3.28)
project(SpectraflowCore VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Sources
set(CORE_SOURCES
    audio/AudioEngine.cpp
    audio/FFTAnalyzer.cpp
    render/DNASystem.cpp
    ai/AIBrain.cpp
)

# Als shared library für Flutter FFI
add_library(spectraflow_core SHARED ${CORE_SOURCES})

target_include_directories(spectraflow_core PUBLIC
    ${CMAKE_CURRENT_SOURCE_DIR}
)

# Platform spezifisch
if(ANDROID)
    target_link_libraries(spectraflow_core log android)
elseif(APPLE)
    target_link_libraries(spectraflow_core "-framework AudioToolbox")
elseif(WIN32)
    target_link_libraries(spectraflow_core winmm)
endif()
