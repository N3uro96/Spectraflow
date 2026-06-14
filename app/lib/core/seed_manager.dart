import 'package:flutter/material.dart';
import 'dart:math';

class SeedManager extends ChangeNotifier {
  int _currentSeed   = 0;
  int _currentShader = 0;

  int get currentSeed   => _currentSeed;
  int get currentShader => _currentShader;

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
    _currentSeed = seed;
    notifyListeners();
  }

  int _randomSeed() => Random().nextInt(999999999);
}
