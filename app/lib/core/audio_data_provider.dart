import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'native_bridge.dart';

class AudioDataProvider extends ChangeNotifier {
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
  double midLeft     = 0.0;
  double highLeft    = 0.0;

  // Texturen für Shader
  ui.Image? texLeft;
  ui.Image? texRight;
  ui.Image? texMid;
  ui.Image? texSide;
  bool texturesReady = false;

  Timer?  _pollTimer;
  bool    _updating = false;

  void start() {
    // 30fps reicht für Shader-Updates
    _pollTimer = Timer.periodic(
      const Duration(milliseconds: 33),
      (_) => _poll(),
    );
  }

  void stop() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _poll() async {
    if (_updating) return;
    _updating = true;

    try {
      final data = await NativeBridge.getFFTData();
      if (data.length < 192) {
        _updating = false;
        return;
      }

      fftLeft  = data.sublist(0,   32);
      fftRight = data.sublist(32,  64);
      fftMid   = data.sublist(64,  96);
      fftSide  = data.sublist(96,  128);
      envLeft  = data.sublist(128, 160);
      envRight = data.sublist(160, 192);

      bassLeft    = (envLeft[0]  + envLeft[1]  + envLeft[2]  + envLeft[3])  / 4.0;
      bassRight   = (envRight[0] + envRight[1] + envRight[2] + envRight[3]) / 4.0;
      midLeft     = (envLeft[8]  + envLeft[9]  + envLeft[10] + envLeft[11]) / 4.0;
      highLeft    = (envLeft[24] + envLeft[25] + envLeft[26] + envLeft[27]) / 4.0;
      energy      = envLeft.fold(0.0, (a, b) => a + b) / 32.0;

      double sideSum = fftSide.fold(0.0, (a, b) => a + b);
      double midSum  = fftMid.fold(0.0,  (a, b) => a + b);
      stereoWidth = midSum > 0.001 ? (sideSum / midSum).clamp(0.0, 1.0) : 0.0;

      // Texturen bauen
      await _buildTextures();

      notifyListeners();
    } catch (e) {
      debugPrint('AudioDataProvider poll error: $e');
    } finally {
      _updating = false;
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

  Future<void> _buildTextures() async {
    final newL = await _makeTexture(envLeft);
    final newR = await _makeTexture(envRight);
    final newM = await _makeTexture(fftMid);
    final newS = await _makeTexture(fftSide);

    texLeft?.dispose();
    texRight?.dispose();
    texMid?.dispose();
    texSide?.dispose();

    texLeft  = newL;
    texRight = newR;
    texMid   = newM;
    texSide  = newS;
    texturesReady = true;
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
