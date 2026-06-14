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
    if (!audio.texturesReady ||
        audio.texLeft  == null ||
        audio.texRight == null ||
        audio.texMid   == null ||
        audio.texSide  == null) {
      return const SizedBox.expand();
    }

    return CustomPaint(
      painter: _ShaderPainter(
        shader:    _shader!,
        time:      _time,
        texLeft:   audio.texLeft!,
        texRight:  audio.texRight!,
        texMid:    audio.texMid!,
        texSide:   audio.texSide!,
        bassLeft:  audio.bassLeft,
        bassRight: audio.bassRight,
        energy:    audio.energy,
        bpm:       audio.bpm,
        beatPhase: audio.beatPhase,
        stereo:    audio.stereoWidth,
      ),
      size: Size.infinite,
    );
  }
}

class _ShaderPainter extends CustomPainter {
  final ui.FragmentShader shader;
  final double            time;
  final ui.Image          texLeft, texRight, texMid, texSide;
  final double            bassLeft, bassRight, energy;
  final double            bpm, beatPhase, stereo;

  _ShaderPainter({
    required this.shader,
    required this.time,
    required this.texLeft,
    required this.texRight,
    required this.texMid,
    required this.texSide,
    required this.bassLeft,
    required this.bassRight,
    required this.energy,
    required this.bpm,
    required this.beatPhase,
    required this.stereo,
  });

  @override
  void paint(Canvas canvas, Size size) {
    shader.setImageSampler(0, texLeft);
    shader.setImageSampler(1, texRight);
    shader.setImageSampler(2, texMid);
    shader.setImageSampler(3, texSide);

    int f = 0;
    shader.setFloat(f++, time);
    shader.setFloat(f++, size.width);
    shader.setFloat(f++, size.height);
    shader.setFloat(f++, bassLeft.clamp(0.0, 1.0));
    shader.setFloat(f++, bassRight.clamp(0.0, 1.0));
    shader.setFloat(f++, energy.clamp(0.0, 1.0));
    shader.setFloat(f++, bpm.clamp(60.0, 200.0));
    shader.setFloat(f++, beatPhase.clamp(0.0, 1.0));
    shader.setFloat(f++, 0.0);
    shader.setFloat(f++, stereo.clamp(0.0, 1.0));
    shader.setFloat(f++, 1.2);
    shader.setFloat(f++, 0.3);
    shader.setFloat(f++, 0.1);
    shader.setFloat(f++, 0.1);
    shader.setFloat(f++, 0.4);
    shader.setFloat(f++, 0.3);
    shader.setFloat(f++, 0.8);

    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..shader = shader,
    );
  }

  @override
  bool shouldRepaint(_ShaderPainter old) => true;
}
