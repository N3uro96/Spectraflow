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

  StreamSubscription<List<double>>? _sub;

  void start() {
    _sub = NativeBridge.audioStream.listen(
      _onData,
      onError: (e) => debugPrint('Audio stream error: $e'),
    );
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
  }

  void _onData(List<double> data) {
    if (data.length < 195) return;

    envLeft  = data.sublist(128, 160);
    envRight = data.sublist(160, 192);
    fftMid   = data.sublist(64,  96);
    fftSide  = data.sublist(96,  128);

    bassLeft  = (envLeft[0]  + envLeft[1]  + envLeft[2]  + envLeft[3])  / 4.0;
    bassRight = (envRight[0] + envRight[1] + envRight[2] + envRight[3]) / 4.0;
    midLeft   = (envLeft[8]  + envLeft[9]  + envLeft[10] + envLeft[11]) / 4.0;
    highLeft  = (envLeft[24] + envLeft[25] + envLeft[26] + envLeft[27]) / 4.0;
    energy    = data[193].clamp(0.0, 1.0);
    bpm       = data[192].clamp(60.0, 200.0);

    final sideSum = fftSide.fold(0.0, (a, b) => a + b);
    final midSum  = fftMid.fold(0.0,  (a, b) => a + b);
    stereoWidth   = midSum > 0.001 ? (sideSum / midSum).clamp(0.0, 1.0) : 0.0;

    notifyListeners();
  }

  @override
  void dispose() {
    stop();
    super.dispose();
  }
}
