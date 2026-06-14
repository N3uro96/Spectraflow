import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../../core/audio_data_provider.dart';

class VisualizerWidget extends StatefulWidget {
  final AudioDataProvider audioData;
  const VisualizerWidget({super.key, required this.audioData});

  @override
  State<VisualizerWidget> createState() => _VisualizerWidgetState();
}

class _VisualizerWidgetState extends State<VisualizerWidget>
    with SingleTickerProviderStateMixin {

  // Shader
  ui.FragmentShader? _warpShader;
  ui.FragmentShader? _compositeShader;
  bool               _loaded = false;
  String?            _error;

  // Ticker für 60fps
  Ticker? _ticker;
  double  _time = 0.0;

  // Feedback Texturen (Double Buffer)
  ui.Image? _feedbackA;
  ui.Image? _feedbackB;
  bool      _useA = true;

  // Interne Auflösung (720p für Performance)
  static const double RENDER_WIDTH  = 720.0;
  static const double RENDER_HEIGHT = 1280.0;

  @override
  void initState() {
    super.initState();
    _loadShaders();
  }

  @override
  void dispose() {
    _ticker?.dispose();
    _feedbackA?.dispose();
    _feedbackB?.dispose();
    super.dispose();
  }

  Future<void> _loadShaders() async {
    try {
      // Warp Shader laden
      final warpProgram = await ui.FragmentProgram.fromAsset(
          'lib/shaders/tunnel_warp.frag');
      // Composite Shader laden
      final compositeProgram = await ui.FragmentProgram.fromAsset(
          'lib/shaders/tunnel_composite.frag');

      setState(() {
        _warpShader      = warpProgram.fragmentShader();
        _compositeShader = compositeProgram.fragmentShader();
        _loaded          = true;
      });

      _ticker = createTicker((elapsed) {
        setState(() => _time = elapsed.inMilliseconds / 1000.0);
      });
      _ticker!.start();

    } catch (e) {
      setState(() => _error = e.toString());
      debugPrint('Shader load error: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Center(child: Text('Shader Error:\n$_error',
          style: const TextStyle(color: Colors.red, fontSize: 10)));
    }
    if (!_loaded) return const SizedBox.expand();

    final audio = widget.audioData;

    return RepaintBoundary(
      child: CustomPaint(
        painter: _TunnelPainter(
          warpShader:      _warpShader!,
          compositeShader: _compositeShader!,
          feedbackTex:     _useA ? _feedbackA : _feedbackB,
          time:            _time,
          bass:            audio.bassLeft.clamp(0.0, 1.0),
          mid:             audio.midLeft.clamp(0.0, 1.0),
          high:            audio.highLeft.clamp(0.0, 1.0),
          energy:          audio.energy.clamp(0.0, 1.0),
          bpm:             audio.bpm,
          stereo:          audio.stereoWidth.clamp(0.0, 1.0),
        ),
        size: Size.infinite,
      ),
    );
  }
}

class _TunnelPainter extends CustomPainter {
  final ui.FragmentShader warpShader;
  final ui.FragmentShader compositeShader;
  final ui.Image?         feedbackTex;
  final double time, bass, mid, high, energy, bpm, stereo;

  _TunnelPainter({
    required this.warpShader,
    required this.compositeShader,
    required this.feedbackTex,
    required this.time,
    required this.bass,
    required this.mid,
    required this.high,
    required this.energy,
    required this.bpm,
    required this.stereo,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // Composite Shader setzen
    int f = 0;
    compositeShader.setFloat(f++, time);
    compositeShader.setFloat(f++, w);
    compositeShader.setFloat(f++, h);
    compositeShader.setFloat(f++, bass);
    compositeShader.setFloat(f++, mid);
    compositeShader.setFloat(f++, high);
    compositeShader.setFloat(f++, energy);
    compositeShader.setFloat(f++, bpm);
    compositeShader.setFloat(f++, stereo);

    // Feedback Textur wenn verfügbar
    if (feedbackTex != null) {
      compositeShader.setImageSampler(0, feedbackTex!);
    }

    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..shader = compositeShader,
    );
  }

  @override
  bool shouldRepaint(_TunnelPainter old) => true;
}
