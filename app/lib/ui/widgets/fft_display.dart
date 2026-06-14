import 'package:flutter/material.dart';
import '../../core/audio_data_provider.dart';

class FFTDisplay extends StatelessWidget {
  final AudioDataProvider audioData;
  const FFTDisplay({super.key, required this.audioData});

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: CustomPaint(
        painter: _FFTPainter(
          envLeft:    audioData.envLeft,
          envRight:   audioData.envRight,
          fftMid:     audioData.fftMid,
          fftSide:    audioData.fftSide,
          stereo:     audioData.stereoWidth,
          bassLeft:   audioData.bassLeft,
          bassRight:  audioData.bassRight,
        ),
        size: Size.infinite,
      ),
    );
  }
}

class _FFTPainter extends CustomPainter {
  final List<double> envLeft, envRight, fftMid, fftSide;
  final double stereo, bassLeft, bassRight;

  _FFTPainter({
    required this.envLeft,
    required this.envRight,
    required this.fftMid,
    required this.fftSide,
    required this.stereo,
    required this.bassLeft,
    required this.bassRight,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // ── FFT Bänder (untere 35%) ──
    final barH     = h * 0.35;
    final barY     = h - barH;
    final barW     = w / 32.0;
    final gap      = barW * 0.12;

    final paintL = Paint()..style = PaintingStyle.fill;
    final paintR = Paint()..style = PaintingStyle.fill;

    for (int i = 0; i < 32; i++) {
      final x = i * barW + gap * 0.5;
      final bw = barW - gap;

      // Linker Kanal (links) – grün → gelb
      final lh = envLeft[i].clamp(0.0, 1.0) * barH;
      final lt = i / 32.0;
      paintL.color = Color.lerp(
        const Color(0xFF00FF88),
        const Color(0xFFFFFF00),
        lt,
      )!.withOpacity(0.85);
      canvas.drawRect(
        Rect.fromLTWH(x, barY + barH - lh, bw * 0.45, lh),
        paintL,
      );

      // Rechter Kanal (rechts) – blau → lila
      final rh = envRight[i].clamp(0.0, 1.0) * barH;
      paintR.color = Color.lerp(
        const Color(0xFF0088FF),
        const Color(0xFFFF00FF),
        lt,
      )!.withOpacity(0.85);
      canvas.drawRect(
        Rect.fromLTWH(x + bw * 0.55, barY + barH - rh, bw * 0.45, rh),
        paintR,
      );
    }

    // Trennlinie
    canvas.drawLine(
      Offset(0, barY),
      Offset(w, barY),
      Paint()
        ..color = Colors.white.withOpacity(0.15)
        ..strokeWidth = 0.5,
    );

    // ── Stereo Meter (horizontaler Balken oben) ──
    final meterH  = h * 0.04;
    final meterY  = 0.0;
    final centerX = w / 2.0;

    // Hintergrund
    canvas.drawRect(
      Rect.fromLTWH(0, meterY, w, meterH),
      Paint()..color = Colors.white.withOpacity(0.05),
    );

    // Stereobreite
    final stereoW = stereo.clamp(0.0, 1.0) * (w / 2.0);
    canvas.drawRect(
      Rect.fromLTWH(centerX - stereoW, meterY, stereoW * 2, meterH),
      Paint()..color = const Color(0xFF8800FF).withOpacity(0.7),
    );

    // Mid (weiß, zentriert)
    final midSum = fftMid.fold(0.0, (a, b) => a + b) / 32.0;
    final midW   = midSum.clamp(0.0, 1.0) * w * 0.4;
    canvas.drawRect(
      Rect.fromLTWH(centerX - midW / 2, meterY, midW, meterH),
      Paint()..color = Colors.white.withOpacity(0.5),
    );

    // Mittellinie
    canvas.drawLine(
      Offset(centerX, meterY),
      Offset(centerX, meterY + meterH),
      Paint()
        ..color = Colors.white.withOpacity(0.4)
        ..strokeWidth = 1.0,
    );

    // L / R Labels
    final labelStyle = const TextStyle(
      color: Colors.white54,
      fontSize: 9,
      fontWeight: FontWeight.w300,
      letterSpacing: 1.5,
    );
    final tpL = TextPainter(
      text: TextSpan(text: 'L', style: labelStyle),
      textDirection: TextDirection.ltr,
    )..layout();
    final tpR = TextPainter(
      text: TextSpan(text: 'R', style: labelStyle),
      textDirection: TextDirection.ltr,
    )..layout();

    tpL.paint(canvas, Offset(4, barY + 4));
    tpR.paint(canvas, Offset(w - 12, barY + 4));
  }

  @override
  bool shouldRepaint(_FFTPainter old) =>
      envLeft  != old.envLeft  ||
      envRight != old.envRight ||
      stereo   != old.stereo;
}
