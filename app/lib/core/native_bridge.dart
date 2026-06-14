import 'package:flutter/services.dart';

class NativeBridge {
  static const _ch = MethodChannel('com.spectraflow.app/engine');

  static Future<bool> init() async {
    try { return await _ch.invokeMethod('init') ?? false; }
    catch (_) { return false; }
  }

  static Future<bool> startMicrophone() async {
    try { return await _ch.invokeMethod('startMicrophone') ?? false; }
    catch (_) { return false; }
  }

  static Future<bool> startFilePlayback(String path) async {
    try { return await _ch.invokeMethod('startFilePlayback', {'path': path}) ?? false; }
    catch (_) { return false; }
  }

  static Future<void> stop() async {
    try { await _ch.invokeMethod('stop'); } catch (_) {}
  }

  // EIN Call – gibt alles zurück
  static Future<List<double>> getAllData() async {
    try {
      final data = await _ch.invokeMethod('getAllData');
      if (data == null) return [];
      return List<double>.from(data);
    } catch (_) { return []; }
  }
}
