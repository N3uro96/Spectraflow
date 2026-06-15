import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import '../../core/audio_data_provider.dart';
import '../../core/feedback_state.dart';
import '../../core/fps_counter.dart';
import '../../core/palette_data.dart';
import '../../core/shader_manager.dart';

class VisualizerWidget extends StatefulWidget {
  final AudioDataProvider audioData;
  final int seed;
  final SFPalette palette;
  final FpsCounter fps;
  final int shaderIndex;
  final VoidCallback? onTap;
  final VoidCallback? onDoubleTap;

  const VisualizerWidget({
    super.key,
    required this.audioData,
    required this.palette,
    required this.fps,
    this.seed = 0,
    this.shaderIndex = 0,
    this.onTap,
    this.onDoubleTap,
  });

  @override
  State<VisualizerWidget> createState() => _VisualizerWidgetState();
}

class _VisualizerWidgetState extends State<VisualizerWidget>
    with SingleTickerProviderStateMixin {
  late Ticker _ticker;
  double _time = 0.0;
  Duration _lastTick = Duration.zero;

  FragmentShader? _shader;
  int _loadedShaderIndex = -1;
  bool _shaderLoading = false;

  // Previous-frame double buffer
  ui.Image? _prevFrame;
  bool _renderingFrame = false;

  final FeedbackState _feedback = FeedbackState();

  @override
  void initState() {
    super.initState();
    _ticker = createTicker(_onTick)..start();
    _loadShader(widget.shaderIndex);
  }

  @override
  void didUpdateWidget(VisualizerWidget old) {
    super.didUpdateWidget(old);
    if (widget.shaderIndex != old.shaderIndex) {
      _loadShader(widget.shaderIndex);
    }
  }

  Future<void> _loadShader(int index) async {
    if (_shaderLoading || index == _loadedShaderIndex) return;
    _shaderLoading = true;
    try {
      final program = await FragmentProgram.fromAsset(kShaderPaths[index]);
      if (!mounted) return;
      setState(() {
        _shader = program.fragmentShader();
        _loadedShaderIndex = index;
      });
    } catch (e) {
      debugPrint('Shader load error (${kShaderPaths[index]}): $e');
    } finally {
      _shaderLoading = false;
    }
  }

  void _onTick(Duration elapsed) {
    final dt = elapsed == Duration.zero
        ? 0.0
        : (elapsed - _lastTick).inMicroseconds / 1e6;
    _lastTick = elapsed;
    _time = elapsed.inMicroseconds / 1e6;

    widget.fps.tick(_time);
    _feedback.update(widget.audioData, dt, _time);

    if (mounted) setState(() {});
  }

  // Converts a Flutter Color to three floats [r, g, b] in linear-ish space.
  static (double, double, double) _toVec3(Color c) => (
        c.red / 255.0,
        c.green / 255.0,
        c.blue / 255.0,
      );

  void _bindUniforms(Size size) {
    final s = _shader!;
    final a = widget.audioData;
    final p = widget.palette;
    int i = 0;

    // Audio (11)
    s.setFloat(i++, _time);
    s.setFloat(i++, size.width);
    s.setFloat(i++, size.height);
    s.setFloat(i++, ((a.bassLeft + a.bassRight) * 0.5).clamp(0.0, 1.0));
    s.setFloat(i++, a.midLeft.clamp(0.0, 1.0));
    s.setFloat(i++, a.highLeft.clamp(0.0, 1.0));
    s.setFloat(i++, a.energy.clamp(0.0, 1.0));
    s.setFloat(i++, a.bpm.clamp(60.0, 200.0));
    s.setFloat(i++, a.stereoWidth.clamp(0.0, 1.0));
    s.setFloat(i++, a.bassLeft.clamp(0.0, 1.0));
    s.setFloat(i++, a.bassRight.clamp(0.0, 1.0));

    // Seed (1)
    s.setFloat(i++, (widget.seed % (1 << 24)).toDouble());

    // Palette (4 × vec3 = 12)
    final (sr, sg, sb) = _toVec3(p.shadow);
    s.setFloat(i++, sr); s.setFloat(i++, sg); s.setFloat(i++, sb);
    final (lr, lg, lb) = _toVec3(p.low);
    s.setFloat(i++, lr); s.setFloat(i++, lg); s.setFloat(i++, lb);
    final (hr, hg, hb) = _toVec3(p.high);
    s.setFloat(i++, hr); s.setFloat(i++, hg); s.setFloat(i++, hb);
    final (hlr, hlg, hlb) = _toVec3(p.highlight);
    s.setFloat(i++, hlr); s.setFloat(i++, hlg); s.setFloat(i++, hlb);

    // Feedback (5)
    s.setFloat(i++, _feedback.zoom);
    s.setFloat(i++, _feedback.rotation);
    s.setFloat(i++, _feedback.decay);
    s.setFloat(i++, _feedback.warpX);
    s.setFloat(i++, _feedback.warpY);

    // Previous frame sampler (index 0)
    if (_prevFrame != null) {
      s.setImageSampler(0, _prevFrame!);
    }
  }

  // Renders the current shader to an offscreen image and stores it as _prevFrame.
  Future<void> _capturePrevFrame(Size size) async {
    if (_renderingFrame || _shader == null) return;
    _renderingFrame = true;

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    _bindUniforms(size);
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..shader = _shader,
    );
    final picture = recorder.endRecording();
    final image = await picture.toImage(size.width.toInt(), size.height.toInt());

    _prevFrame?.dispose();
    _prevFrame = image;
    _renderingFrame = false;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onDoubleTap: widget.onDoubleTap,
      child: RepaintBoundary(
        child: CustomPaint(
          painter: _ShaderPainter(
            shader: _shader,
            time: _time,
            audioData: widget.audioData,
            palette: widget.palette,
            seed: widget.seed,
            feedback: _feedback,
            prevFrame: _prevFrame,
            onBindUniforms: _bindUniforms,
            onCapturePrevFrame: _capturePrevFrame,
          ),
          size: Size.infinite,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _ticker.dispose();
    _prevFrame?.dispose();
    super.dispose();
  }
}

class _ShaderPainter extends CustomPainter {
  final FragmentShader? shader;
  final double time;
  final AudioDataProvider audioData;
  final SFPalette palette;
  final int seed;
  final FeedbackState feedback;
  final ui.Image? prevFrame;
  final void Function(Size) onBindUniforms;
  final Future<void> Function(Size) onCapturePrevFrame;

  _ShaderPainter({
    required this.shader,
    required this.time,
    required this.audioData,
    required this.palette,
    required this.seed,
    required this.feedback,
    required this.prevFrame,
    required this.onBindUniforms,
    required this.onCapturePrevFrame,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (shader == null) {
      // Fallback: simple FFT bars while shader is loading
      _paintFallback(canvas, size);
      return;
    }

    onBindUniforms(size);
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..shader = shader,
    );

    // Kick off prev-frame capture for next tick (fire-and-forget)
    onCapturePrevFrame(size);
  }

  void _paintFallback(Canvas canvas, Size size) {
    canvas.drawRect(
      Rect.fromLTWH(0, 0, size.width, size.height),
      Paint()..color = const Color(0xFF050505),
    );
    final barW = size.width / 32.0;
    final halfH = size.height * 0.44;
    final topY = size.height * 0.05;
    for (int i = 0; i < 32; i++) {
      final val = audioData.envLeft[i].clamp(0.0, 1.0);
      final bh = val * halfH;
      canvas.drawRect(
        Rect.fromLTWH(i * barW + 1, topY + halfH - bh, barW - 2, bh),
        Paint()..color = Color.lerp(palette.shadow, palette.low, i / 31.0)!,
      );
    }
    final botY = size.height * 0.52;
    for (int i = 0; i < 32; i++) {
      final val = audioData.envRight[i].clamp(0.0, 1.0);
      final bh = val * halfH;
      canvas.drawRect(
        Rect.fromLTWH(i * barW + 1, botY, barW - 2, bh),
        Paint()..color = Color.lerp(palette.high, palette.highlight, i / 31.0)!,
      );
    }
  }

  @override
  bool shouldRepaint(_ShaderPainter old) =>
      old.time != time ||
      old.shader != shader ||
      old.prevFrame != prevFrame ||
      old.seed != seed ||
      old.palette != palette;
}
