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

    // Schwarzer Hintergrund
    canvas.drawRect(
      Rect.fromLTWH(0, 0, w, h),
      Paint()..color = const Color(0xFF050505),
    );

    // ── FFT Bänder Links (grün, obere Hälfte) ──
    final barW   = w / 32.0;
    final halfH  = h * 0.45;
    final topY   = h * 0.05;

    for (int i = 0; i < 32; i++) {
      final val = data.envLeft[i].clamp(0.0, 1.0);
      final bh  = val * halfH;
      final x   = i * barW + 1;

      canvas.drawRect(
        Rect.fromLTWH(x, topY + halfH - bh, barW - 2, bh),
        Paint()..color = Color.lerp(
          const Color(0xFF00FF44),
          const Color(0xFFFFFF00),
          i / 32.0,
        )!,
      );
    }

    // ── FFT Bänder Rechts (blau, untere Hälfte) ──
    final botY = h * 0.52;

    for (int i = 0; i < 32; i++) {
      final val = data.envRight[i].clamp(0.0, 1.0);
      final bh  = val * halfH;
      final x   = i * barW + 1;

      canvas.drawRect(
        Rect.fromLTWH(x, botY, barW - 2, bh),
        Paint()..color = Color.lerp(
          const Color(0xFF0088FF),
          const Color(0xFFFF00FF),
          i / 32.0,
        )!,
      );
    }

    // ── Stereo Meter (Mitte) ──
    final meterY = h * 0.49;
    final meterH = h * 0.02;
    final cx     = w / 2.0;
    final sw     = data.stereoWidth.clamp(0.0, 1.0) * (w / 2.0);

    // Hintergrund
    canvas.drawRect(
      Rect.fromLTWH(0, meterY, w, meterH),
      Paint()..color = Colors.white.withOpacity(0.05),
    );

    // Stereobreite (lila)
    canvas.drawRect(
      Rect.fromLTWH(cx - sw, meterY, sw * 2, meterH),
      Paint()..color = const Color(0xFF8800FF).withOpacity(0.8),
    );

    // Mittellinie
    canvas.drawLine(
      Offset(cx, meterY),
      Offset(cx, meterY + meterH),
      Paint()..color = Colors.white54..strokeWidth = 1,
    );

    // ── Labels ──
    _drawText(canvas, 'L  FFT', Offset(8, topY - 16),
        const Color(0xFF00FF44));
    _drawText(canvas, 'R  FFT', Offset(8, botY - 16),
        const Color(0xFF0088FF));
    _drawText(canvas, 'STEREO', Offset(cx - 24, meterY - 16),
        Colors.white54);
    _drawText(canvas, 'BPM: ${data.bpm.toStringAsFixed(0)}',
        Offset(8, h - 20), Colors.white38);
    _drawText(canvas,
        'E: ${(data.energy * 100).toStringAsFixed(0)}%',
        Offset(w - 80, h - 20), Colors.white38);
  }

  void _drawText(Canvas canvas, String text, Offset pos, Color color) {
    final tp = TextPainter(
      text: TextSpan(
        text: text,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w300,
          letterSpacing: 1.2,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, pos);
  }

  @override
  bool shouldRepaint(_DiagnosticPainter old) => true;
}
