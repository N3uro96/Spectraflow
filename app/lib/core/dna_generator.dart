import 'dart:math' as math;

class DNAParams {
  final double zoom;
  final double rotation;
  final double warpX;
  final double warpY;
  final double waveFreq;
  final double colorSpeed;
  final double spokes;
  final double bassReact;
  final double midReact;
  final double phase;

  const DNAParams({
    required this.zoom,
    required this.rotation,
    required this.warpX,
    required this.warpY,
    required this.waveFreq,
    required this.colorSpeed,
    required this.spokes,
    required this.bassReact,
    required this.midReact,
    required this.phase,
  });

  static const DNAParams defaults = DNAParams(
    zoom: 1.015,
    rotation: 1.0,
    warpX: 0.0,
    warpY: 0.0,
    waveFreq: 4.0,
    colorSpeed: 1.0,
    spokes: 6.0,
    bassReact: 1.0,
    midReact: 1.0,
    phase: 0.0,
  );
}

class DNAGenerator {
  // xorshift32-inspired hash — deterministisch, schnell
  static int _hash(int x) {
    x = (x ^ (x >> 16)) & 0xFFFFFFFF;
    x = (x * 0x45d9f3b) & 0xFFFFFFFF;
    x = (x ^ (x >> 16)) & 0xFFFFFFFF;
    x = (x * 0x45d9f3b) & 0xFFFFFFFF;
    x = (x ^ (x >> 16)) & 0xFFFFFFFF;
    return x;
  }

  static double _toRange(int h, double min, double max) {
    return min + (h / 0xFFFFFFFF) * (max - min);
  }

  static DNAParams generate(int seed) {
    int h = seed;
    int next() {
      h = _hash(h + 0x9e3779b9);
      return h;
    }

    // Rotation: nie nahe 0, damit der Tunnel immer dreht.
    // Vorzeichen aus separatem Hash-Bit bestimmen.
    final rotRaw  = _toRange(next(), 0.4, 2.0);
    final rotSign = (next() & 1) == 0 ? 1.0 : -1.0;

    // Spokes: ganze Zahlen 2-10
    final spokesRaw = _toRange(next(), 2.0, 10.5).floorToDouble().clamp(2.0, 10.0);

    return DNAParams(
      zoom:       _toRange(next(), 0.7, 1.4),
      rotation:   rotRaw * rotSign,
      warpX:      _toRange(next(), -0.6, 0.6),
      warpY:      _toRange(next(), -0.6, 0.6),
      waveFreq:   _toRange(next(), 1.0, 8.0),
      colorSpeed: _toRange(next(), 0.2, 2.5),
      spokes:     spokesRaw,
      bassReact:  _toRange(next(), 0.3, 1.0),
      midReact:   _toRange(next(), 0.3, 1.0),
      phase:      _toRange(next(), 0.0, math.pi * 2.0),
    );
  }
}
