import 'dart:async';
import 'dart:isolate';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flutter/foundation.dart';

// ─────────────────────────────────────────
// Isolate Task – läuft im Background
// Kein Flutter, kein UI – nur reine Daten
// ─────────────────────────────────────────
Uint8List _buildPixels(List<double> bands) {
  final pixels = Uint8List(32 * 4);
  for (int i = 0; i < 32; i++) {
    final v = (bands[i].clamp(0.0, 1.0) * 255).toInt();
    pixels[i * 4]     = v;
    pixels[i * 4 + 1] = v;
    pixels[i * 4 + 2] = v;
    pixels[i * 4 + 3] = 255;
  }
  return pixels;
}

// ─────────────────────────────────────────
// Texture Manager – Double Buffer
// ─────────────────────────────────────────
class TextureManager {
  // Double Buffer pro Kanal
  ui.Image? _texA_left,  _texB_left;
  ui.Image? _texA_right, _texB_right;
  ui.Image? _texA_mid,   _texB_mid;
  ui.Image? _texA_side,  _texB_side;
  bool      _useA   = true;
  bool      _busy   = false;

  // Aktuelle Texturen für den Shader
  ui.Image? get texLeft  => _useA ? _texA_left  : _texB_left;
  ui.Image? get texRight => _useA ? _texA_right : _texB_right;
  ui.Image? get texMid   => _useA ? _texA_mid   : _texB_mid;
  ui.Image? get texSide  => _useA ? _texA_side  : _texB_side;
  bool      get ready    => texLeft != null && texRight != null;

  // Neue FFT Daten → baut Back-Buffer im Hintergrund
  Future<void> update({
    required List<double> left,
    required List<double> right,
    required List<double> mid,
    required List<double> side,
  }) async {
    if (_busy) return;
    _busy = true;

    try {
      // Pixel-Daten im Background-Isolate berechnen
      final futures = await Future.wait([
        compute(_buildPixels, left),
        compute(_buildPixels, right),
        compute(_buildPixels, mid),
        compute(_buildPixels, side),
      ]);

      // Images aus Pixel-Daten erstellen
      final images = await Future.wait([
        _pixelsToImage(futures[0]),
        _pixelsToImage(futures[1]),
        _pixelsToImage(futures[2]),
        _pixelsToImage(futures[3]),
      ]);

      // In Back-Buffer schreiben
      if (_useA) {
        _texB_left?.dispose();  _texB_left  = images[0];
        _texB_right?.dispose(); _texB_right = images[1];
        _texB_mid?.dispose();   _texB_mid   = images[2];
        _texB_side?.dispose();  _texB_side  = images[3];
      } else {
        _texA_left?.dispose();  _texA_left  = images[0];
        _texA_right?.dispose(); _texA_right = images[1];
        _texA_mid?.dispose();   _texA_mid   = images[2];
        _texA_side?.dispose();  _texA_side  = images[3];
      }

      // Swap – atomic
      _useA = !_useA;
    } finally {
      _busy = false;
    }
  }

  Future<ui.Image> _pixelsToImage(Uint8List pixels) async {
    final buf   = await ui.ImmutableBuffer.fromUint8List(pixels);
    final desc  = ui.ImageDescriptor.raw(
      buf,
      width: 32,
      height: 1,
      pixelFormat: ui.PixelFormat.rgba8888,
    );
    final codec = await desc.instantiateCodec();
    return (await codec.getNextFrame()).image;
  }

  void dispose() {
    _texA_left?.dispose();  _texB_left?.dispose();
    _texA_right?.dispose(); _texB_right?.dispose();
    _texA_mid?.dispose();   _texB_mid?.dispose();
    _texA_side?.dispose();  _texB_side?.dispose();
  }
}
