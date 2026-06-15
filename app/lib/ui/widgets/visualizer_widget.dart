import 'dart:typed_data';
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
  double _dpr = 1.0;

  ui.FragmentShader? _shader;
  int _loadedShaderIndex = -1;
  bool _shaderLoading = false;

  // 1×1 transparent fallback so the sampler is always bound.
  ui.Image? _dummy;

  // Last rendered frame – shown on screen AND fed back into the shader.
  ui.Image? _front;
  bool _rendering = false;

  final FeedbackState _feedback = FeedbackState();

  @override
  void initState() {
    super.initState();
    _initDummy();
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

  Future<void> _initDummy() async {
    final data = Uint8List(4); // (0,0,0,0) – fully transparent
    final buf = await ui.ImmutableBuffer.fromUint8List(data);
    final desc = ui.ImageDescriptor.raw(buf,
        width: 1, height: 1, pixelFormat: ui.PixelFormat.rgba8888);
    final codec = await desc.instantiateCodec();
    final frame = await codec.getNextFrame();
    if (!mounted) {
      frame.image.dispose();
      return;
    }
    _dummy = frame.image;
  }

  Future<void> _loadShader(int index) async {
    if (_shaderLoading || index == _loadedShaderIndex) return;
    _shaderLoading = true;
    try {
      final program = await ui.FragmentProgram.fromAsset(kShaderPaths[index]);
      if (!mounted) return;
      _shader = program.fragmentShader();
      _loadedShaderIndex = index;
      // drop the old feedback buffer so trails don't bleed across shaders
      _front?.dispose();
      _front = null;
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

  static (double, double, double) _toVec3(Color c) =>
      (c.red / 255.0, c.green / 255.0, c.blue / 255.0);

  // Binds every uniform. `pixelSize` is the physical render resolution.
  void _bindUniforms(Size pixelSize) {
    final s = _shader!;
    final a = widget.audioData;
    final p = widget.palette;
    int i = 0;

    // Audio (11)
    s.setFloat(i++, _time);
    s.setFloat(i++, pixelSize.width);
    s.setFloat(i++, pixelSize.height);
    s.setFloat(i++, ((a.bassLeft + a.bassRight) * 0.5).clamp(0.0, 1.0));
    s.setFloat(i++, a.midLeft.clamp(0.0, 1.0));
    s.setFloat(i++, a.highLeft.clamp(0.0, 1.0));
    s.setFloat(i++, a.energy.clamp(0.0, 1.0));
    s.setFloat(i++, a.bpm.clamp(60.0, 200.0));
    s.setFloat(i++, a.stereoWidth.clamp(0.0, 1.0));
    s.setFloat(i++, a.bassLeft.clamp(0.0, 1.0));
    s.setFloat(i++, a.bassRight.clamp(0.0, 1.0));

    // Seed (1) – raw; shaders normalize internally
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

    // Previous frame sampler (index 0) – ALWAYS bound (dummy if no frame yet)
    final sampler = _front ?? _dummy;
    if (sampler != null) {
      s.setImageSampler(0, sampler);
    }
  }

  // Renders the shader offscreen → becomes the new _front (and feedback source).
  Future<void> _render(Size logical) async {
    if (_rendering || _shader == null || _dummy == null) return;
    final w = (logical.width * _dpr).round();
    final h = (logical.height * _dpr).round();
    if (w <= 0 || h <= 0) return;

    _rendering = true;
    try {
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      _bindUniforms(Size(w.toDouble(), h.toDouble()));
      canvas.drawRect(
        Rect.fromLTWH(0, 0, w.toDouble(), h.toDouble()),
        Paint()..shader = _shader,
      );
      final picture = recorder.endRecording();
      final image = await picture.toImage(w, h);
      picture.dispose();

      final old = _front;
      _front = image;
      old?.dispose();
    } catch (e) {
      debugPrint('Shader render error: $e');
    } finally {
      _rendering = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    _dpr = MediaQuery.of(context).devicePixelRatio;
    return GestureDetector(
      onTap: widget.onTap,
      onDoubleTap: widget.onDoubleTap,
      child: RepaintBoundary(
        child: CustomPaint(
          painter: _ShaderPainter(
            frame: _front,
            time: _time,
            audioData: widget.audioData,
            palette: widget.palette,
            onRender: _render,
          ),
          size: Size.infinite,
        ),
      ),
    );
  }

  @override
  void dispose() {
    _ticker.dispose();
    _front?.dispose();
    _dummy?.dispose();
    super.dispose();
  }
}

class _ShaderPainter extends CustomPainter {
  final ui.Image? frame;
  final double time;
  final AudioDataProvider audioData;
  final SFPalette palette;
  final Future<void> Function(Size) onRender;

  _ShaderPainter({
    required this.frame,
    required this.time,
    required this.audioData,
    required this.palette,
    required this.onRender,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (frame != null) {
      canvas.drawImageRect(
        frame!,
        Rect.fromLTWH(0, 0, frame!.width.toDouble(), frame!.height.toDouble()),
        Rect.fromLTWH(0, 0, size.width, size.height),
        Paint()..filterQuality = FilterQuality.low,
      );
    } else {
      _paintFallback(canvas, size);
    }

    // Schedule the next offscreen render (fire-and-forget, self-guarded).
    onRender(size);
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
  bool shouldRepaint(_ShaderPainter old) => true;
}
