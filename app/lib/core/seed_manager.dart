import 'package:flutter/material.dart';
import 'dart:math';

class SeedManager extends ChangeNotifier {
  int _currentSeed = 0;

  int get currentSeed => _currentSeed;

  static const int _maxSafeSeed = 1 << 24;

  SeedManager() {
    _currentSeed = _randomSeed();
  }

  void randomize() {
    _currentSeed = _randomSeed();
    notifyListeners();
  }

  void setSeed(int seed) {
    _currentSeed = seed % _maxSafeSeed;
    notifyListeners();
  }

  int _randomSeed() => Random().nextInt(_maxSafeSeed);
}
