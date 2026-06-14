import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../../core/audio_data_provider.dart';
import '../../core/dna_generator.dart';

class VisualizerWidget extends StatefulWidget {
  final AudioDataProvider audioData;
  final DNAParams dna;

  const VisualizerWidget({
    super.key,
    required this.audioData,
    this.dna = DNAParams.defaults,
  });

  @override
  State<VisualizerWidget> createState() => _VisualizerWidgetState();
}

class _VisualizerWidgetState extends State<VisualizerWidget>
    with SingleTickerProviderStateMixin {

  ui.FragmentShader? _shader;
  bool               _loaded = false;
  String?            _error;
  Ticker?            _ticker;
  double             _time = 0.0;

  @override
  void initState() {
    super.initState();
    _loadShader();
  }

  @override
  void dispose() {
    _ticker?.dispose();
    super.dispose();
  }

  Future<void> _loadShader() async {
    try {
      final program = await ui.FragmentProgram.fromAsset(
          'lib/shaders/tunnel_composite.frag');
      setState(() {
        _shader = program.fragmentShader();
        _loaded = true;
      });
      _ticker = createTicker((elapsed) {
        setState(() => _time = elapsed.inMilliseconds / 1000.0);
      });
      _ticker!.start();
    } catch (e) {
      setState(() => _error = e.toString());
      debugPrint('Shader error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Center(child: Text('Shader Error:\n$_error',
          style: const TextStyle(color: Colors.red, fontSize: 10)));
    }
    if (!_loaded || _shader == null) return const SizedBox.expand();

    final audio = widget.audioData;

    return RepaintBoundary(
      child: CustomPaint(
        painter: _TunnelPainter(
          shader:    _shader!,
          time:      _time,
          bass:      audio.bassLeft.clamp(0.0, 1.0),
          mid:       audio.midLeft.clamp(0.0, 1.0),
          high:      audio.highLeft.clamp(0.0, 1.0),
          energy:    audio.energy.clamp(0.0, 1.0),
          bpm:       audio.bpm,
          stereo:    audio.stereoWidth.clamp(0.0, 1.0),
          bassLeft:  audio.bassLeft.clamp(0.0, 1.0),
          bassRight: audio.bassRight.clamp(0.0, 1.0),
          dna:       widget.dna,
        ),
        size: Size.infinite,
      ),
    );
  }
}

class _TunnelPainter extends CustomPainter {
  final ui.FragmentShader shader;
  final double time, bass, mid, high, energy, bpm, stereo;
  final double bassLeft, bassRight;
  final DNAParams dna;

  _TunnelPainter({
    required this.shader,
    required this.time,
    required this.bass,
    required this.mid,
    required this.high,
    required this.energy,
    required this.bpm,
    required this.stereo,
    required this.bassLeft,
    required this.bassRight,
    required this.dna,
  });

  @override
  void paint(Canvas canvas, Size size) {
    int f = 0;
    // Audio uniforms (0–10)
    shader.setFloat(f++, time);
    shader.setFloat(f++, size.width);
    shader.setFloat(f++, size.height);
    shader.setFloat(f++, bass);
    shader.setFloat(f++, mid);
    shader.setFloat(f++, high);
    shader.setFloat(f++, energy);
    shader.setFloat(f++, bpm);
    shader.setFloat(f++, stereo);
    shader.setFloat(f++, bassLeft);
    shader.setFloat(f++, bassRight);
    // DNA uniforms (11–20)
    shader.setFloat(f++, dna.zoom);
    shader.setFloat(f++, dna.rotation);
    shader.setFloat(f++, dna.warpX);
    shader.setFloat(f++, dna.warpY);
    shader.setFloat(f++, dna.waveFreq);
    shader.setFloat(f++, dna.colorSpeed);
    shader.setFloat(f++, dna.spokes);
    shader.setFloat(f++, dna.bassReact);
    shader.setFloat(f++, dna.midReact);
    shader.setFloat(f++, dna.phase);

    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..shader = shader,
    );
  }

  @override
  bool shouldRepaint(_TunnelPainter old) => true;
}
