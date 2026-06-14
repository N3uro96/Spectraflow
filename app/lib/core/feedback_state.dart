import 'dart:math' as math;
import 'dna_generator.dart';
import 'audio_data_provider.dart';

class FeedbackState {
  double zoom     = 1.0;
  double rotation = 0.0;
  double decay    = 0.95;
  double warpX    = 0.0;
  double warpY    = 0.0;

  static const double _smooth = 0.12;

  void update(DNAParams dna, AudioDataProvider audio, double dt, double time) {
    final bass   = ((audio.bassLeft + audio.bassRight) * 0.5).clamp(0.0, 1.0);
    final mid    = audio.midLeft.clamp(0.0, 1.0);
    final energy = audio.energy.clamp(0.0, 1.0);

    // Zoom: sehr nah an 1.0 — Bass treibt kurze Pulse
    final targetZoom = (1.0 + (dna.zoom - 1.0) * 0.005 + bass * dna.bassReact * 0.008)
        .clamp(0.988, 1.022);

    // Rotation pro Frame: DNA-Speed + Mid-Boost
    final targetRot = (dna.rotation * 0.0015 + mid * dna.midReact * 0.001)
        .clamp(-0.008, 0.008);

    // Milkdrop-Vertex-Warp: DNA → sanftes Sinuswellen-Offset im Feedback-UV
    final targetWarpX = dna.warpX * 0.005 + math.sin(time * dna.waveFreq * 0.4) * dna.warpX.abs() * 0.001;
    final targetWarpY = dna.warpY * 0.005 + math.cos(time * dna.waveFreq * 0.4) * dna.warpY.abs() * 0.001;

    zoom     += _smooth * (targetZoom  - zoom);
    rotation += _smooth * (targetRot   - rotation);
    warpX    += _smooth * (targetWarpX - warpX);
    warpY    += _smooth * (targetWarpY - warpY);

    // Decay: hohe Energie → schnelleres Ausblenden (reactivere Optik)
    decay = (0.958 - energy * 0.030).clamp(0.902, 0.975);
  }
}
