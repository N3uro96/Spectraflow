import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

class ShaderCanvas extends StatefulWidget {
  const ShaderCanvas({super.key});

  @override
  State<ShaderCanvas> createState() => _ShaderCanvasState();
}

class _ShaderCanvasState extends State<ShaderCanvas>
    with SingleTickerProviderStateMixin {
  ui.FragmentShader? _shader;
  Ticker?            _ticker;
  double             _time   = 0.0;
  bool               _loaded = false;

  final List<double> _fftLeft  = List.generate(32, (i) =>
      0.1 + 0.3 * (i % 8) / 8.0);
  final List<double> _fftRight = List.generate(32, (i) =>
      0.15 + 0.25 * ((i + 4) % 8) / 8.0);

  @override
  void initState() {
    super.initState();
    _loadShader();
  }

  Future<void> _loadShader() async {
    final program = await ui.FragmentProgram.fromAsset(
      'lib/shaders/test_shader.frag',
    );
    setState(() {
      _shader = program.fragmentShader();
      _loaded = true;
    });
    _ticker = createTicker((elapsed) {
      setState(() => _time = elapsed.inMilliseconds / 1000.0);
    });
    _ticker!.start();
  }

  @override
  void dispose() {
    _ticker?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded || _shader == null) return const SizedBox.expand();
    return CustomPaint(
      painter: _ShaderPainter(
        shader: _shader!,
        time: _time,
        fftLeft: _fftLeft,
        fftRight: _fftRight,
      ),
      size: Size.infinite,
    );
  }
}

class _ShaderPainter extends CustomPainter {
  final ui.FragmentShader shader;
  final double            time;
  final List<double>      fftLeft;
  final List<double>      fftRight;

  _ShaderPainter({
    required this.shader,
    required this.time,
    required this.fftLeft,
    required this.fftRight,
  });

  @override
  void paint(Canvas canvas, Size size) {
    int idx = 0;
    shader.setFloat(idx++, time);
    shader.setFloat(idx++, size.width);
    shader.setFloat(idx++, size.height);
    for (int i = 0; i < 32; i++) shader.setFloat(idx++, fftLeft[i]);
    for (int i = 0; i < 32; i++) shader.setFloat(idx++, fftRight[i]);
    for (int i = 0; i < 32; i++) shader.setFloat(idx++, (fftLeft[i] + fftRight[i]) * 0.5);
    for (int i = 0; i < 32; i++) shader.setFloat(idx++, (fftLeft[i] - fftRight[i]).abs() * 0.5);
    for (int i = 0; i < 32; i++) shader.setFloat(idx++, fftLeft[i]);
    for (int i = 0; i < 32; i++) shader.setFloat(idx++, fftRight[i]);
    shader.setFloat(idx++, 0.6);
    shader.setFloat(idx++, 0.5);
    shader.setFloat(idx++, 0.4);
    shader.setFloat(idx++, 0.45);
    shader.setFloat(idx++, 0.2);
    shader.setFloat(idx++, 0.25);
    shader.setFloat(idx++, 0.5);
    shader.setFloat(idx++, 128.0);
    shader.setFloat(idx++, (time * 2.0) % 1.0);
    shader.setFloat(idx++, 0.0);
    shader.setFloat(idx++, 0.75);
    shader.setFloat(idx++, 1.2);
    shader.setFloat(idx++, 0.5);
    shader.setFloat(idx++, 0.1);
    shader.setFloat(idx++, 0.1);
    shader.setFloat(idx++, 0.05);
    shader.setFloat(idx++, 0.05);
    for (int i = 0; i < 16; i++) shader.setFloat(idx++, 0.5);
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..shader = shader,
    );
  }

  @override
  bool shouldRepaint(_ShaderPainter old) => true;
}
