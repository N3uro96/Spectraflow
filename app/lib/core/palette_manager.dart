import 'dart:math';
import 'package:flutter/material.dart';
import 'palette_data.dart';

class PaletteManager extends ChangeNotifier {
  int _index = 0;
  SFPalette? _random; // nicht-null = zufällige Palette aktiv

  SFPalette get current => _random ?? kPalettes[_index];
  Color     get accent  => current.highlight;

  // Einfacher Tap: nächste feste Palette
  void next() {
    _random = null;
    _index  = (_index + 1) % kPalettes.length;
    notifyListeners();
  }

  // Doppel-Tap: zufällig generierte Palette
  void randomize() {
    _random = _makeRandom();
    notifyListeners();
  }

  SFPalette _makeRandom() {
    final rng    = Random();
    final h      = rng.nextDouble();
    final s      = 0.65 + rng.nextDouble() * 0.35;
    final scheme = rng.nextInt(3); // 0=mono, 1=komplementär, 2=analog

    Color hsv(double hue, double sat, double val) =>
        HSVColor.fromAHSV(1.0, hue * 360 % 360, sat.clamp(0.0, 1.0), val.clamp(0.0, 1.0)).toColor();

    switch (scheme) {
      case 0: // Monochrom
        return SFPalette(
          name:      'Random Mono',
          shadow:    hsv(h, s,        0.08),
          low:       hsv(h, s,        0.30),
          high:      hsv(h, s * 0.8,  0.70),
          highlight: hsv(h, s * 0.45, 1.00),
        );
      case 1: // Komplementär (Gegenfarbe)
        return SFPalette(
          name:      'Random Comp',
          shadow:    hsv(h,          s,        0.10),
          low:       hsv(h,          s,        0.45),
          high:      hsv(h + 0.5,    s,        0.70),
          highlight: hsv(h + 0.5,    s * 0.5,  1.00),
        );
      default: // Analog (benachbarte Farben)
        return SFPalette(
          name:      'Random Analog',
          shadow:    hsv(h,          s,        0.08),
          low:       hsv(h + 0.08,   s,        0.40),
          high:      hsv(h + 0.16,   s * 0.9,  0.75),
          highlight: hsv(h + 0.08,   s * 0.5,  1.00),
        );
    }
  }
}
