import 'package:flutter/services.dart';

class NativeBridge {
  static const _method = MethodChannel('com.spectraflow.app/engine');
  static const _event  = EventChannel('com.spectraflow.app/audio_data');

  // Stream der Audio Daten – kein Polling mehr
  static Stream<List<double>> get audioStream =>
      _event.receiveBroadcastStream().map((data) =>
          List<double>.from(data as List));

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
