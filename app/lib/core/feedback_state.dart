import 'dart:math' as math;
import 'audio_data_provider.dart';

class FeedbackState {
  double zoom     = 1.0;
  double rotation = 0.0;
  double decay    = 0.95;
  double warpX    = 0.0;
  double warpY    = 0.0;

  static const double _smooth = 0.12;

  // Feste Defaults, die vorher aus DNA kamen.
  static const double _baseZoom      = 1.015;
  static const double _baseRotation  = 1.0;
  static const double _baseWarpX     = 0.0;
  static const double _baseWarpY     = 0.0;
  static const double _waveFreq      = 4.0;
  static const double _bassReact     = 1.0;
  static const double _midReact      = 1.0;

  void update(AudioDataProvider audio, double dt, double time) {
    final bass   = ((audio.bassLeft + audio.bassRight) * 0.5).clamp(0.0, 1.0);
    final mid    = audio.midLeft.clamp(0.0, 1.0);
    final energy = audio.energy.clamp(0.0, 1.0);

    final targetZoom = (1.0 + (_baseZoom - 1.0) * 0.005 + bass * _bassReact * 0.008)
        .clamp(0.988, 1.022);

    final targetRot = (_baseRotation * 0.0015 + mid * _midReact * 0.001)
        .clamp(-0.008, 0.008);

    final targetWarpX = _baseWarpX * 0.005
        + math.sin(time * _waveFreq * 0.4) * _baseWarpX.abs() * 0.001;
    final targetWarpY = _baseWarpY * 0.005
        + math.cos(time * _waveFreq * 0.4) * _baseWarpY.abs() * 0.001;

    zoom     += _smooth * (targetZoom  - zoom);
    rotation += _smooth * (targetRot   - rotation);
    warpX    += _smooth * (targetWarpX - warpX);
    warpY    += _smooth * (targetWarpY - warpY);

    decay = (0.958 - energy * 0.030).clamp(0.902, 0.975);
  }
}
