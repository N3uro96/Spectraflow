import 'package:flutter/material.dart';
import '../../core/audio_data_provider.dart';

class ShaderCanvas extends StatelessWidget {
  final AudioDataProvider audioData;
  const ShaderCanvas({super.key, required this.audioData});

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: CustomPaint(
        painter: _DiagnosticPainter(audioData),
        size: Size.infinite,
      ),
    );
  }
}

class _DiagnosticPainter extends CustomPainter {
  final AudioDataProvider data;
  _DiagnosticPainter(this.data) : super(repaint: data);

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    canvas.drawRect(Rect.fromLTWH(0, 0, w, h),
        Paint()..color = const Color(0xFF050505));

    final barW  = w / 32.0;
    final halfH = h * 0.44;

    // Linker Kanal (oben)
    final topY = h * 0.05;
    for (int i = 0; i < 32; i++) {
      final val = data.envLeft[i].clamp(0.0, 1.0);
      final bh  = val * halfH;
      canvas.drawRect(
        Rect.fromLTWH(i * barW + 1, topY + halfH - bh, barW - 2, bh),
        Paint()..color = Color.lerp(
          const Color(0xFF00FF44),
          const Color(0xFFFFFF00),
          i / 31.0,
        )!,
      );
    }

    // Rechter Kanal (unten)
    final botY = h * 0.52;
    for (int i = 0; i < 32; i++) {
      final val = data.envRight[i].clamp(0.0, 1.0);
      final bh  = val * halfH;
      canvas.drawRect(
        Rect.fromLTWH(i * barW + 1, botY, barW - 2, bh),
        Paint()..color = Color.lerp(
          const Color(0xFF0088FF),
          const Color(0xFFFF00FF),
          i / 31.0,
        )!,
      );
    }

    // Stereo Meter
    final mY = h * 0.49;
    final mH = h * 0.02;
    final cx  = w / 2.0;
    final sw  = data.stereoWidth.clamp(0.0, 1.0) * (w / 2.0);

    canvas.drawRect(Rect.fromLTWH(0, mY, w, mH),
        Paint()..color = Colors.white.withOpacity(0.05));
    canvas.drawRect(Rect.fromLTWH(cx - sw, mY, sw * 2, mH),
        Paint()..color = const Color(0xFF8800FF).withOpacity(0.8));
    canvas.drawLine(Offset(cx, mY), Offset(cx, mY + mH),
        Paint()..color = Colors.white54..strokeWidth = 1);

    _text(canvas, 'L', Offset(4, topY), const Color(0xFF00FF44));
    _text(canvas, 'R', Offset(4, botY - 14), const Color(0xFF0088FF));
    _text(canvas, 'BPM ${data.bpm.toStringAsFixed(0)}',
        Offset(8, h - 16), Colors.white38);
    _text(canvas, 'E ${(data.energy * 100).toStringAsFixed(0)}%',
        Offset(w - 60, h - 16), Colors.white38);
  }

  void _text(Canvas canvas, String t, Offset o, Color c) {
    (TextPainter(
      text: TextSpan(text: t,
          style: TextStyle(color: c, fontSize: 10, letterSpacing: 1.2)),
      textDirection: TextDirection.ltr,
    )..layout()).paint(canvas, o);
  }

  @override
  // shouldRepaint wird bei repaint: listenable nicht gebraucht
  // aber true damit Widget-rebuilds auch neuzeichnen
  bool shouldRepaint(_DiagnosticPainter old) => true;
}
