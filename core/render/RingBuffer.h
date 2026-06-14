#pragma once
#include <mutex>

template<typename T, size_t SIZE>
class RingBuffer {
public:
    RingBuffer() : has_data_(false) {}

    bool push(const T& item) {
        // Überschreibt gnadenlos den alten Frame mit dem neusten.
        // So läuft der Buffer niemals voll.
        std::lock_guard<std::mutex> lock(mutex_);
        latest_data_ = item;
        has_data_ = true;
        return true;
    }

    bool pop(T& item) {
        return peek_latest(item);
    }

    bool peek_latest(T& item) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (!has_data_) return false;
        
        // Gibt immer den neusten Frame an das JNI/Flutter UI zurück
        item = latest_data_;
        return true;
    }

private:
    T latest_data_{};
    bool has_data_;
    std::mutex mutex_;
};