import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../../core/audio_data_provider.dart';

class ShaderCanvas extends StatefulWidget {
  final AudioDataProvider audioData;
  const ShaderCanvas({super.key, required this.audioData});

  @override
  State<ShaderCanvas> createState() => _ShaderCanvasState();
}

class _ShaderCanvasState extends State<ShaderCanvas>
    with SingleTickerProviderStateMixin {
  ui.FragmentShader? _shader;
  Ticker?            _ticker;
  double             _time   = 0.0;
  bool               _loaded = false;
  String?            _error;

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
          'lib/shaders/test_shader.frag');
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
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Center(child: Text('Shader: $_error',
          style: const TextStyle(color: Colors.red, fontSize: 10)));
    }
    if (!_loaded || _shader == null) return const SizedBox.expand();

    final a = widget.audioData;

    return CustomPaint(
      painter: _ShaderPainter(
        shader:    _shader!,
        time:      _time,
        bass:      a.bassLeft.clamp(0.0, 1.0),
        mid:       a.midLeft.clamp(0.0, 1.0),
        high:      a.highLeft.clamp(0.0, 1.0),
        energy:    a.energy.clamp(0.0, 1.0),
        bpm:       a.bpm.clamp(60.0, 200.0),
        beatPhase: a.beatPhase.clamp(0.0, 1.0),
        stereo:    a.stereoWidth.clamp(0.0, 1.0),
      ),
      size: Size.infinite,
    );
  }
}

class _ShaderPainter extends CustomPainter {
  final ui.FragmentShader shader;
  final double time, bass, mid, high, energy, bpm, beatPhase, stereo;

  _ShaderPainter({
    required this.shader,
    required this.time,
    required this.bass,
    required this.mid,
    required this.high,
    required this.energy,
    required this.bpm,
    required this.beatPhase,
    required this.stereo,
  });

  @override
  void paint(Canvas canvas, Size size) {
    int f = 0;
    shader.setFloat(f++, time);
    shader.setFloat(f++, size.width);
    shader.setFloat(f++, size.height);
    shader.setFloat(f++, bass);
    shader.setFloat(f++, mid);
    shader.setFloat(f++, high);
    shader.setFloat(f++, energy);
    shader.setFloat(f++, bpm);
    shader.setFloat(f++, beatPhase);
    shader.setFloat(f++, 0.0); // beat_onset
    shader.setFloat(f++, stereo);

    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..shader = shader,
    );
  }

  @override
  bool shouldRepaint(_ShaderPainter old) => true;
}
