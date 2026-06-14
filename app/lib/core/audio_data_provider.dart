import 'dart:async';
import 'package:flutter/material.dart';
import 'native_bridge.dart';

class AudioDataProvider extends ChangeNotifier {
  List<double> envLeft  = List.filled(32, 0.0);
  List<double> envRight = List.filled(32, 0.0);
  List<double> fftMid   = List.filled(32, 0.0);
  List<double> fftSide  = List.filled(32, 0.0);

  double bpm         = 120.0;
  double energy      = 0.0;
  double stereoWidth = 0.0;
  double bassLeft    = 0.0;
  double bassRight   = 0.0;
  double midLeft     = 0.0;
  double highLeft    = 0.0;
  double beatPhase   = 0.0;

  Timer? _timer;

  void start() {
    _timer = Timer.periodic(
      const Duration(milliseconds: 16), // 60fps
      (_) => _poll(),
    );
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _poll() async {
    try {
      final data = await NativeBridge.getFFTData();
      if (data.length < 192) return;

      envLeft  = data.sublist(128, 160);
      envRight = data.sublist(160, 192);
      fftMid   = data.sublist(64,  96);
      fftSide  = data.sublist(96,  128);

      bassLeft  = (envLeft[0]  + envLeft[1]  + envLeft[2]  + envLeft[3])  / 4.0;
      bassRight = (envRight[0] + envRight[1] + envRight[2] + envRight[3]) / 4.0;
      midLeft   = (envLeft[8]  + envLeft[9]  + envLeft[10] + envLeft[11]) / 4.0;
      highLeft  = (envLeft[24] + envLeft[25] + envLeft[26] + envLeft[27]) / 4.0;
      energy    = envLeft.fold(0.0, (a, b) => a + b) / 32.0;

      final sideSum = fftSide.fold(0.0, (a, b) => a + b);
      final midSum  = fftMid.fold(0.0,  (a, b) => a + b);
      stereoWidth   = midSum > 0.001 ? (sideSum / midSum).clamp(0.0, 1.0) : 0.0;

      bpm = await NativeBridge.getBpm();

      notifyListeners();
    } catch (e) {
      debugPrint('Poll error: $e');
    }
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}
