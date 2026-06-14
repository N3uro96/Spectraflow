import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;
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
  double beatPhase   = 0.0;
  double bassLeft    = 0.0;
  double bassRight   = 0.0;

  // Texturen
  ui.Image? texLeft;
  ui.Image? texRight;
  ui.Image? texMid;
  ui.Image? texSide;
  bool      texturesReady = false;

  Timer? _pollTimer;
  bool   _building = false;

  void start() {
    _pollTimer = Timer.periodic(
      const Duration(milliseconds: 50), // 20fps für Texturen
      (_) => _poll(),
    );
  }

  void stop() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _poll() async {
    if (_building) return;
    _building = true;

    try {
      final data = await NativeBridge.getFFTData();
      if (data.length < 192) { _building = false; return; }

      final newEnvLeft  = data.sublist(128, 160);
      final newEnvRight = data.sublist(160, 192);
      final newFftMid   = data.sublist(64,  96);
      final newFftSide  = data.sublist(96,  128);

      // Aggregierte Werte
      bassLeft  = (newEnvLeft[0]  + newEnvLeft[1]  + newEnvLeft[2]  + newEnvLeft[3])  / 4.0;
      bassRight = (newEnvRight[0] + newEnvRight[1] + newEnvRight[2] + newEnvRight[3]) / 4.0;
      energy    = newEnvLeft.fold(0.0, (a, b) => a + b) / 32.0;

      double sideSum = newFftSide.fold(0.0, (a, b) => a + b);
      double midSum  = newFftMid.fold(0.0,  (a, b) => a + b);
      stereoWidth    = midSum > 0.001 ? (sideSum / midSum).clamp(0.0, 1.0) : 0.0;

      bpm = await NativeBridge.getBpm();

      // Neue Texturen bauen
      final nL = await _makeTexture(newEnvLeft);
      final nR = await _makeTexture(newEnvRight);
      final nM = await _makeTexture(newFftMid);
      final nS = await _makeTexture(newFftSide);

      // Erst alte disposen wenn neue fertig sind
      texLeft?.dispose();
      texRight?.dispose();
      texMid?.dispose();
      texSide?.dispose();

      texLeft       = nL;
      texRight      = nR;
      texMid        = nM;
      texSide       = nS;
      envLeft       = newEnvLeft;
      envRight      = newEnvRight;
      fftMid        = newFftMid;
      fftSide       = newFftSide;
      texturesReady = true;

      notifyListeners();
    } catch (e) {
      debugPrint('Poll error: $e');
    } finally {
      _building = false;
    }
  }

  Future<ui.Image> _makeTexture(List<double> bands) async {
    final pixels = Uint8List(32 * 4);
    for (int i = 0; i < 32; i++) {
      final v = (bands[i].clamp(0.0, 1.0) * 255).toInt();
      pixels[i * 4]     = v;
      pixels[i * 4 + 1] = v;
      pixels[i * 4 + 2] = v;
      pixels[i * 4 + 3] = 255;
    }
    final buf   = await ui.ImmutableBuffer.fromUint8List(pixels);
    final desc  = ui.ImageDescriptor.raw(buf,
        width: 32, height: 1, pixelFormat: ui.PixelFormat.rgba8888);
    final codec = await desc.instantiateCodec();
    return (await codec.getNextFrame()).image;
  }

  @override
  void dispose() {
    stop();
    texLeft?.dispose();
    texRight?.dispose();
    texMid?.dispose();
    texSide?.dispose();
    super.dispose();
  }
}
