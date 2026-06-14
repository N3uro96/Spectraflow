import 'dart:typed_data';
import 'package:flutter/services.dart';

class NativeBridge {
  static const _method = MethodChannel('com.spectraflow.app/engine');
  static const _event  = EventChannel('com.spectraflow.app/audio_data');

  // Float32List direkt – kein Boxing, kein GC
  static Stream<Float32List> get audioStream =>
      _event.receiveBroadcastStream().map((data) => data as Float32List);

  static Future<bool> init() async {
    try { return await _method.invokeMethod('init') ?? false; }
    catch (_) { return false; }
  }

  static Future<bool> startMicrophone() async {
    try { return await _method.invokeMethod('startMicrophone') ?? false; }
    catch (_) { return false; }
  }

  static Future<bool> startFilePlayback(String path) async {
    try { return await _method.invokeMethod('startFilePlayback', {'path': path}) ?? false; }
    catch (_) { return false; }
  }

  static Future<void> stop() async {
    try { await _method.invokeMethod('stop'); } catch (_) {}
  }
}
