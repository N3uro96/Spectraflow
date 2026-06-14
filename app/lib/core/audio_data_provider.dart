import 'dart:async';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'native_bridge.dart';

class AudioDataProvider extends ChangeNotifier {
  final Float64List envLeft  = Float64List(32);
  final Float64List envRight = Float64List(32);
  final Float64List fftMid   = Float64List(32);
  final Float64List fftSide  = Float64List(32);
  
  double bpm         = 120.0;
  double energy      = 0.0;
  double stereoWidth = 0.0;
  double bassLeft    = 0.0;
  double bassRight   = 0.0;
  double midLeft     = 0.0;
  double highLeft    = 0.0;

  StreamSubscription<Float64List>? _sub; // FIX: Angepasst auf Float64List

  void start() {
    _sub = NativeBridge.audioStream.listen(_onData,
        onError: (e) => debugPrint('Stream error: $e'));
  }

  void stop() { 
    _sub?.cancel(); 
    _sub = null; 
  }

  // FIX: Angepasst auf Float64List
  void _onData(Float64List raw) {
    if (raw.length < 195) return;
    
    for (int i = 0; i < 32; i++) {
      envLeft[i]  = raw[128 + i];
      envRight[i] = raw[160 + i];
      fftMid[i]   = raw[64  + i];
      fftSide[i]  = raw[96  + i];
    }
    
    bassLeft  = (envLeft[0]  + envLeft[1]  + envLeft[2]  + envLeft[3])  / 4.0;
    bassRight = (envRight[0] + envRight[1] + envRight[2] + envRight[3]) / 4.0;
    midLeft   = (envLeft[8]  + envLeft[9]  + envLeft[10] + envLeft[11]) / 4.0;
    highLeft  = (envLeft[24] + envLeft[25] + envLeft[26] + envLeft[27]) / 4.0;
    
    energy    = raw[193].clamp(0.0, 1.0);
    bpm       = raw[192].clamp(60.0, 200.0);

    double sideSum = 0.0, midSum = 0.0;
    for (int i = 0; i < 32; i++) { 
      sideSum += fftSide[i]; 
      midSum += fftMid[i];
    }
    
    stereoWidth = midSum > 0.001 ? (sideSum / midSum).clamp(0.0, 1.0) : 0.0;
    notifyListeners();
  }

  @override
  void dispose() { 
    stop(); 
    super.dispose(); 
  }
}