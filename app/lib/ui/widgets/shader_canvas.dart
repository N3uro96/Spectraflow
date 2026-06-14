import 'dart:typed_data';
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

  ui.Image? _texLeft;
  ui.Image? _texRight;
  ui.Image? _texMid;
  ui.Image? _texSide;

  @override
  void initState() {
    super.initState();
    _loadShader();
    widget.audioData.addListener(_onAudioUpdate);
  }

  @override
  void dispose() {
    widget.audioData.removeListener(_onAudioUpdate);
    _ticker?.dispose();
    _texLeft?.dispose();
    _texRight?.dispose();
    _texMid?.dispose();
    _texSide?.dispose();
    super.dispose();
  }

  void _onAudioUpdate() {
    if (!mounted) return;
    _updateTextures();
  }

  Future<ui.Image> _buildTexture(List<double> bands) async {
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
      width: 32, height: 1,
      pixelFormat: ui.PixelFormat.rgba8888,
    ).instantiateCodec();
    return (await codec.getNextFrame()).image;
  }

  Future<void> _updateTextures() async {
    final audio = widget.audioData;
    final newLeft  = await _buildTexture(audio.envLeft);
    final newRight = await _buildTexture(audio.envRight);
    final newMid   = await _buildTexture(audio.fftMid);
    final newSide  = await _buildTexture(audio.fftSide);

    if (!mounted) {
      newLeft.dispose(); newRight.dispose();
      newMid.dispose();  newSide.dispose();
      return;
    }

    _texLeft?.dispose();
    _texRight?.dispose();
    _texMid?.dispose();
    _texSide?.dispose();

    setState(() {
      _texLeft  = newLeft;
      _texRight = newRight;
      _texMid   = newMid;
      _texSide  = newSide;
    });
  }

  Future<void> _loadShader() async {
    try {
      final program = await ui.FragmentProgram.fromAsset(
        'lib/shaders/test_shader.frag',
      );

      // Initial Texturen mit Nullen
      _texLeft  = await _buildTexture(List.filled(32, 0.0));
      _texRight = await _buildTexture(List.filled(32, 0.0));
      _texMid   = await _buildTexture(List.filled(32, 0.0));
      _texSide  = await _buildTexture(List.filled(32, 0.0));

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
      return Center(
        child: Text('Shader Error: $_error',
          style: const TextStyle(color: Colors.red, fontSize: 10)),
      );
    }
    if (!_loaded || _shader == null || _texLeft == null) {
      return const SizedBox.expand();
    }

    final audio = widget.audioData;

    return CustomPaint(
      painter: _ShaderPainter(
        shader:     _shader!,
        time:       _time,
        texLeft:    _texLeft!,
        texRight:   _texRight!,
        texMid:     _texMid!,
        texSide:    _texSide!,
        bassLeft:   audio.bassLeft,
        bassRight:  audio.bassRight,
        energy:     audio.energy,
        bpm:        audio.bpm,
        beatPhase:  audio.beatPhase,
        stereo:     audio.stereoWidth,
      ),
      size: Size.infinite,
    );
  }
}

class _ShaderPainter extends CustomPainter {
  final ui.FragmentShader shader;
  final double            time;
  final ui.Image          texLeft, texRight, texMid, texSide;
  final double            bassLeft, bassRight, energy, bpm, beatPhase, stereo;

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
    shader.setFloat(f++, bassLeft);
    shader.setFloat(f++, bassRight);
    shader.setFloat(f++, energy.clamp(0.0, 1.0));
    shader.setFloat(f++, bpm);
    shader.setFloat(f++, beatPhase);
    shader.setFloat(f++, 0.0);           // beat_onset
    shader.setFloat(f++, stereo.clamp(0.0, 1.0));
    shader.setFloat(f++, 1.2);           // zoom
    shader.setFloat(f++, 0.3);           // rotation
    shader.setFloat(f++, 0.1);           // warp_x
    shader.setFloat(f++, 0.1);           // warp_y
    shader.setFloat(f++, 0.4);           // param8
    shader.setFloat(f++, 0.3);           // param9
    shader.setFloat(f++, 0.8);           // param11

    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..shader = shader,
    );
  }

  @override
  bool shouldRepaint(_ShaderPainter old) => true;
}
