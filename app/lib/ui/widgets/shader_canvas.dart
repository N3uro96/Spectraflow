import 'dart:typed_data';
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
  String?            _error;

  final List<double> _fftLeft  = List.generate(32, (i) =>
      0.3 + 0.5 * (i % 8) / 8.0);
  final List<double> _fftRight = List.generate(32, (i) =>
      0.35 + 0.45 * ((i + 4) % 8) / 8.0);

  ui.Image? _texLeft;
  ui.Image? _texRight;
  ui.Image? _texMid;
  ui.Image? _texSide;

  @override
  void initState() {
    super.initState();
    _loadShader();
  }

  Future<ui.Image> _buildFFTTexture(List<double> bands) async {
    final pixels = Uint8List(32 * 4);
    for (int i = 0; i < 32; i++) {
      final val = (bands[i].clamp(0.0, 1.0) * 255).toInt();
      pixels[i * 4 + 0] = val;
      pixels[i * 4 + 1] = val;
      pixels[i * 4 + 2] = val;
      pixels[i * 4 + 3] = 255;
    }
    final codec = await ui.ImageDescriptor.raw(
      await ui.ImmutableBuffer.fromUint8List(pixels),
      width: 32,
      height: 1,
      pixelFormat: ui.PixelFormat.rgba8888,
    ).instantiateCodec();
    return (await codec.getNextFrame()).image;
  }

  Future<void> _loadShader() async {
    try {
      final program = await ui.FragmentProgram.fromAsset(
        'lib/shaders/test_shader.frag',
      );

      final mid  = List.generate(32, (i) =>
          (_fftLeft[i] + _fftRight[i]) * 0.5);
      final side = List.generate(32, (i) =>
          (_fftLeft[i] - _fftRight[i]).abs() * 0.5);

      _texLeft  = await _buildFFTTexture(_fftLeft);
      _texRight = await _buildFFTTexture(_fftRight);
      _texMid   = await _buildFFTTexture(mid);
      _texSide  = await _buildFFTTexture(side);

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
  void dispose() {
    _ticker?.dispose();
    _texLeft?.dispose();
    _texRight?.dispose();
    _texMid?.dispose();
    _texSide?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Center(
        child: Text('Shader Error: $_error',
          style: const TextStyle(color: Colors.red, fontSize: 12)),
      );
    }
    if (!_loaded || _shader == null ||
        _texLeft == null || _texRight == null) {
      return const SizedBox.expand();
    }
    return CustomPaint(
      painter: _ShaderPainter(
        shader:   _shader!,
        time:     _time,
        texLeft:  _texLeft!,
        texRight: _texRight!,
        texMid:   _texMid!,
        texSide:  _texSide!,
      ),
      size: Size.infinite,
    );
  }
}

class _ShaderPainter extends CustomPainter {
  final ui.FragmentShader shader;
  final double            time;
  final ui.Image          texLeft;
  final ui.Image          texRight;
  final ui.Image          texMid;
  final ui.Image          texSide;

  _ShaderPainter({
    required this.shader,
    required this.time,
    required this.texLeft,
    required this.texRight,
    required this.texMid,
    required this.texSide,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // Texturen (müssen zuerst gesetzt werden)
    shader.setImageSampler(0, texLeft);
    shader.setImageSampler(1, texRight);
    shader.setImageSampler(2, texMid);
    shader.setImageSampler(3, texSide);

    // Floats – exakt in der Reihenfolge wie im Shader deklariert
    int f = 0;
    shader.setFloat(f++, time);
    shader.setFloat(f++, size.width);
    shader.setFloat(f++, size.height);
    shader.setFloat(f++, 0.6);                    // u_bass_left
    shader.setFloat(f++, 0.5);                    // u_bass_right
    shader.setFloat(f++, 0.6);                    // u_energy
    shader.setFloat(f++, 128.0);                  // u_bpm
    shader.setFloat(f++, (time * 2.0) % 1.0);    // u_beat_phase
    shader.setFloat(f++, 0.0);                    // u_beat_onset
    shader.setFloat(f++, 0.75);                   // u_stereo_width
    shader.setFloat(f++, 1.2);                    // u_zoom
    shader.setFloat(f++, 0.3);                    // u_rotation
    shader.setFloat(f++, 0.1);                    // u_warp_x
    shader.setFloat(f++, 0.1);                    // u_warp_y
    shader.setFloat(f++, 0.4);                    // u_param8
    shader.setFloat(f++, 0.3);                    // u_param9
    shader.setFloat(f++, 0.8);                    // u_param11

    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..shader = shader,
    );
  }

  @override
  bool shouldRepaint(_ShaderPainter old) => true;
}
