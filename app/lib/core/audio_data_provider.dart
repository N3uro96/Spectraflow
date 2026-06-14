import 'dart:async';
import 'package:flutter/material.dart';
import 'native_bridge.dart';

class AudioDataProvider extends ChangeNotifier {
  // FFT Daten (32 Bänder pro Kanal)
  List<double> fftLeft  = List.filled(32, 0.0);
  List<double> fftRight = List.filled(32, 0.0);
  List<double> fftMid   = List.filled(32, 0.0);
  List<double> fftSide  = List.filled(32, 0.0);
  List<double> envLeft  = List.filled(32, 0.0);
  List<double> envRight = List.filled(32, 0.0);

  double bpm         = 120.0;
  double energy      = 0.0;
  double stereoWidth = 0.0;
  double beatPhase   = 0.0;
  double bassLeft    = 0.0;
  double bassRight   = 0.0;

  Timer? _timer;

  void start() {
    // 60fps polling
    _timer = Timer.periodic(
      const Duration(milliseconds: 16),
      (_) => _poll(),
    );
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _poll() async {
    final data = await NativeBridge.getFFTData();
    if (data.isEmpty || data.length < 192) return;

    // 192 floats: 6x32 Bänder
    fftLeft  = data.sublist(0,   32);
    fftRight = data.sublist(32,  64);
    fftMid   = data.sublist(64,  96);
    fftSide  = data.sublist(96,  128);
    envLeft  = data.sublist(128, 160);
    envRight = data.sublist(160, 192);

    // Aggregierte Werte
    bassLeft    = (envLeft[0]  + envLeft[1]  + envLeft[2]  + envLeft[3])  / 4.0;
    bassRight   = (envRight[0] + envRight[1] + envRight[2] + envRight[3]) / 4.0;
    energy      = envLeft.fold(0.0, (a, b) => a + b) / 32.0;
    stereoWidth = fftSide.fold(0.0, (a, b) => a + b) /
                  (fftMid.fold(0.0, (a, b) => a + b) + 1e-6);
    stereoWidth = stereoWidth.clamp(0.0, 1.0);

    bpm = await NativeBridge.getBpm();

    notifyListeners();
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}
