#pragma once
#include <array>
#include <cstddef>
#include <mutex>

template<typename T, size_t SIZE>
class RingBuffer {
public:
    RingBuffer() : head_(0), tail_(0) {}

    bool push(const T& item) {
        std::lock_guard<std::mutex> lock(mutex_);
        size_t next = (head_ + 1) % SIZE;
        if (next == tail_) return false; // Buffer voll
        buffer_[head_] = item;
        head_ = next;
        return true;
    }

    bool pop(T& item) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (tail_ == head_) return false; // Buffer leer
        item = buffer_[tail_];
        tail_ = (tail_ + 1) % SIZE;
        return true;
    }

    bool peek_latest(T& item) {
        std::lock_guard<std::mutex> lock(mutex_);
        if (head_ == tail_) return false; // Buffer leer
        size_t latest = (head_ == 0) ? SIZE - 1 : head_ - 1;
        item = buffer_[latest];
        return true;
    }

private:
    std::array<T, SIZE> buffer_;
    size_t head_;
    size_t tail_;
    std::mutex mutex_;
};