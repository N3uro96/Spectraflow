#pragma once
#include <atomic>
#include <array>
#include <cstddef>

// Lock-free Single Producer Single Consumer Ring Buffer
template<typename T, size_t SIZE>
class RingBuffer {
public:
    RingBuffer() : head_(0), tail_(0) {}

    // Vom Audio Thread (Producer)
    bool push(const T& item) {
        size_t head = head_.load(std::memory_order_relaxed);
        size_t next = (head + 1) % SIZE;
        if (next == tail_.load(std::memory_order_acquire))
            return false; // voll
        buffer_[head] = item;
        head_.store(next, std::memory_order_release);
        return true;
    }

    // Vom Render Thread (Consumer)
    bool pop(T& item) {
        size_t tail = tail_.load(std::memory_order_relaxed);
        if (tail == head_.load(std::memory_order_acquire))
            return false; // leer
        item = buffer_[tail];
        tail_.store((tail + 1) % SIZE, std::memory_order_release);
        return true;
    }

    // Neuestes Element ohne pop
    bool peek_latest(T& item) {
        size_t head = head_.load(std::memory_order_acquire);
        size_t tail = tail_.load(std::memory_order_relaxed);
        if (head == tail) return false;
        size_t latest = (head == 0) ? SIZE - 1 : head - 1;
        item = buffer_[latest];
        return true;
    }

private:
    std::array<T, SIZE> buffer_;
    std::atomic<size_t> head_;
    std::atomic<size_t> tail_;
};
