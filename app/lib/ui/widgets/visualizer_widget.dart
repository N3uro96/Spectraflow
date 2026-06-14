import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:provider/provider.dart';
import '../../core/audio_data_provider.dart';
import '../../core/feedback_state.dart';
import '../../core/fps_counter.dart';
import '../../core/palette_data.dart';

const List<String> kShaderPaths = [
  'lib/shaders/smoke.frag',
  'lib/shaders/tunnel.frag',
  'lib/shaders/plasma.frag',
  'lib/shaders/particles.frag',
  'lib/shaders/kaleidoscope.frag',
  'lib/shaders/chessboard.frag',
  'lib/shaders/fractal.frag',
  'lib/shaders/blinding_lights.frag',
];

const List<String> kShaderNames = ['SMOKE', 'TUNNEL', 'PLASMA', 'PARTICLES', 'KALEIDO', 'CHESS', 'FRACTAL', 'BLINDING'];

class VisualizerWidget extends StatefulWidget {
  final AudioDataProvider audioData;
  final int               seed;
  final SFPalette         palette;
  final String            shaderPath;
  final VoidCallback?     onTap;
  final VoidCallback?     onDoubleTap;

  const VisualizerWidget({
    super.key,
    required this.audioData,
    this.seed       = 0,
    required this.palette,
    this.shaderPath = 'lib/shaders/smoke.frag',
    this.onTap,
    this.onDoubleTap,
  });

  @override
  State<VisualizerWidget> createState() => _VisualizerWidgetState();
}

class _VisualizerWidgetState extends State<VisualizerWidget>
    with TickerProviderStateMixin {

  ui.FragmentShader?  _shader;
  bool                _loaded = false;
  String?             _error;
  Ticker?             _ticker;
  double              _time   = 0.0;
  double              _lastMs = 0.0;
  ui.Image?           _prevFrame;
  final FeedbackState _feedback   = FeedbackState();
  FpsCounter?         _fpsCounter;

  @override
  void initState() {
    super.initState();
    _loadShader();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _fpsCounter = Provider.of<FpsCounter>(context, listen: false);
  }

  @override
  void didUpdateWidget(VisualizerWidget old) {
    super.didUpdateWidget(old);
    if (old.shaderPath != widget.shaderPath) {
      _ticker?.dispose();
      _ticker    = null;
      _prevFrame?.dispose();
      _prevFrame = null;
      _shader    = null;
      _loaded    = false;
      _loadShader();
    } else if (old.seed != widget.seed && _loaded) {
      _resetFeedback();
    }
  }

  void _resetFeedback() {
    final rec = ui.PictureRecorder();
    Canvas(rec).drawRect(
      const Rect.fromLTWH(0, 0, 1, 1),
      Paint()..color = const Color(0xFF000000),
    );
    final black = rec.endRecording().toImageSync(1, 1);
    final old   = _prevFrame;
    setState(() {
      _prevFrame = black;
    });
    old?.dispose();
  }

  @override
  void dispose() {
    _ticker?.dispose();
    _prevFrame?.dispose();
    super.dispose();
  }

  Future<void> _loadShader() async {
    try {
      final program = await ui.FragmentProgram.fromAsset(widget.shaderPath);

      // Schwarzes 1×1-Platzhalter-Frame damit sampler2D immer gesetzt ist
      final rec = ui.PictureRecorder();
      Canvas(rec).drawRect(
        const Rect.fromLTWH(0, 0, 1, 1),
        Paint()..color = const Color(0xFF000000),
      );
      final blackFrame = rec.endRecording().toImageSync(1, 1);

      setState(() {
        _shader    = program.fragmentShader();
        _loaded    = true;
        _prevFrame = blackFrame;
      });

      _ticker = createTicker(_onTick);
      _ticker!.start();
    } catch (e) {
      setState(() => _error = e.toString());
      debugPrint('Shader error: $e');
    }
  }

  void _onTick(Duration elapsed) {
    final ms = elapsed.inMilliseconds.toDouble();
    final dt = ((ms - _lastMs) / 1000.0).clamp(0.0, 0.05);
    _lastMs  = ms;
    _time    = ms / 1000.0;
    _feedback.update(widget.audioData, dt, _time);
    _fpsCounter?.tick(_time);
    setState(() {});
  }

  // Aktualisiert _prevFrame nach jedem gerenderten Frame
  void _onNewFrame(ui.Image newFrame) {
    final old = _prevFrame;
    _prevFrame = newFrame;
    // Skia-Ref-Counting: GPU hält das Bild solange es noch gerastert wird
    old?.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Center(child: Text('Shader Error:\n$_error',
          style: const TextStyle(color: Colors.red, fontSize: 10)));
    }
    if (!_loaded || _shader == null || _prevFrame == null) {
      return const SizedBox.expand();
    }

    final audio = widget.audioData;
    final dpr   = MediaQuery.of(context).devicePixelRatio;

    return GestureDetector(
      onTap:       widget.onTap,
      onDoubleTap: widget.onDoubleTap,
      child: RepaintBoundary(
        child: CustomPaint(
          painter: _TunnelPainter(
            shader:     _shader!,
            time:       _time,
            bass:       audio.bassLeft.clamp(0.0, 1.0),
            mid:        audio.midLeft.clamp(0.0, 1.0),
            high:       audio.highLeft.clamp(0.0, 1.0),
            energy:     audio.energy.clamp(0.0, 1.0),
            bpm:        audio.bpm,
            stereo:     audio.stereoWidth.clamp(0.0, 1.0),
            bassLeft:   audio.bassLeft.clamp(0.0, 1.0),
            bassRight:  audio.bassRight.clamp(0.0, 1.0),
            seed:       widget.seed,
            palette:    widget.palette,
            feedback:   _feedback,
            prevFrame:  _prevFrame!,
            dpr:        dpr,
            onNewFrame: _onNewFrame,
          ),
          size: Size.infinite,
        ),
      ),
    );
  }
}

class _TunnelPainter extends CustomPainter {
  final ui.FragmentShader          shader;
  final double                     time, bass, mid, high, energy, bpm, stereo;
  final double                     bassLeft, bassRight;
  final int                        seed;
  final SFPalette                  palette;
  final FeedbackState              feedback;
  final ui.Image                   prevFrame;
  final void Function(ui.Image)    onNewFrame;
  final double                     dpr;

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
    required this.seed,
    required this.palette,
    required this.feedback,
    required this.prevFrame,
    required this.onNewFrame,
    required this.dpr,
  });

  void _setColor(int idx, Color c) {
    shader.setFloat(idx,     c.red   / 255.0);
    shader.setFloat(idx + 1, c.green / 255.0);
    shader.setFloat(idx + 2, c.blue  / 255.0);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final double physW = size.width  * dpr;
    final double physH = size.height * dpr;
    final int    iw    = physW.toInt();
    final int    ih    = physH.toInt();
    if (iw <= 0 || ih <= 0) return;

    // ── Offscreen-Render (für Frame-Capture) ──────────────
    final recorder  = ui.PictureRecorder();
    final offCanvas = Canvas(recorder);

    // Float-Uniforms setzen (Indices 0–28)
    int f = 0;
    // Audio (0–10)
    shader.setFloat(f++, time);
    shader.setFloat(f++, physW);
    shader.setFloat(f++, physH);
    shader.setFloat(f++, bass);
    shader.setFloat(f++, mid);
    shader.setFloat(f++, high);
    shader.setFloat(f++, energy);
    shader.setFloat(f++, bpm);
    shader.setFloat(f++, stereo);
    shader.setFloat(f++, bassLeft);
    shader.setFloat(f++, bassRight);
    // Seed (11) — normalisiert [0,1) damit sin() in GLSL präzise bleibt
    shader.setFloat(f++, seed / 16777216.0);
    // Palette (12–23)
    _setColor(f, palette.shadow);    f += 3;
    _setColor(f, palette.low);       f += 3;
    _setColor(f, palette.high);      f += 3;
    _setColor(f, palette.highlight); f += 3;
    // Feedback (24–28)
    shader.setFloat(f++, feedback.zoom);
    shader.setFloat(f++, feedback.rotation);
    shader.setFloat(f++, feedback.decay);
    shader.setFloat(f++, feedback.warpX);
    shader.setFloat(f++, feedback.warpY);

    // Sampler: vorheriges Frame als Feedback-Textur
    shader.setImageSampler(0, prevFrame);

    // In Offscreen-Canvas rendern (physische Pixel)
    offCanvas.drawRect(
      Rect.fromLTWH(0, 0, physW, physH),
      Paint()..shader = shader,
    );

    // Frame-Capture bei nativer Auflösung
    final picture  = recorder.endRecording();
    final newFrame = picture.toImageSync(iw, ih);

    // 1:1 pixel-mapping: physisches Bild zurück auf logische Koordinaten skalieren
    canvas.save();
    canvas.scale(1.0 / dpr, 1.0 / dpr);
    canvas.drawImage(newFrame, Offset.zero, Paint());
    canvas.restore();

    // Neues Frame für nächsten Zyklus speichern
    onNewFrame(newFrame);
  }

  @override
  bool shouldRepaint(_TunnelPainter old) => true;
}
