import 'package:flutter/foundation.dart';

class FpsCounter extends ChangeNotifier {
  double _fps = 0.0;
  double get fps => _fps;

  int    _frames    = 0;
  double _windowStart = 0.0;

  // Wird jeden Ticker-Frame aufgerufen (time in Sekunden seit Start)
  void tick(double time) {
    _frames++;
    final elapsed = time - _windowStart;
    if (elapsed >= 1.0) {
      _fps        = _frames / elapsed;
      _frames     = 0;
      _windowStart = time;
      notifyListeners(); // nur 1× pro Sekunde → keine excess rebuilds
    }
  }
}
