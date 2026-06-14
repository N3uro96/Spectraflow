import 'package:flutter/material.dart';
import 'dart:math';

class SeedManager extends ChangeNotifier {
  int _currentSeed   = 0;
  int _currentShader = 0;

  int get currentSeed   => _currentSeed;
  int get currentShader => _currentShader;

  // Max seed for exact Float32 representation (2^24 = 16,777,216)
  static const int _maxSafeSeed = 1 << 24;

  SeedManager() {
    _currentSeed = _randomSeed();
  }

  // Neuen zufälligen Seed generieren
  void randomize() {
    _currentSeed = _randomSeed();
    notifyListeners();
  }

  // Shader wechseln
  void setShader(int id) {
    _currentShader = id;
    notifyListeners();
  }

  // Nächsten Shader aktivieren (zyklisch)
  void nextShader(int count) {
    _currentShader = (_currentShader + 1) % count;
    notifyListeners();
  }

  // Seed manuell setzen (später für KI)
  void setSeed(int seed) {
    _currentSeed = seed % _maxSafeSeed;
    notifyListeners();
  }

  int _randomSeed() => Random().nextInt(_maxSafeSeed);
}
