import 'package:flutter/services.dart';

class NativeBridge {
  static const _channel = MethodChannel('com.spectraflow.app/engine');

  static Future<bool> init() async {
    try {
      return await _channel.invokeMethod('init') ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<bool> startMicrophone() async {
    try {
      return await _channel.invokeMethod('startMicrophone') ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<bool> startFilePlayback(String path) async {
    try {
      return await _channel.invokeMethod('startFilePlayback', {'path': path}) ?? false;
    } catch (e) {
      return false;
    }
  }

  static Future<void> stop() async {
    try {
      await _channel.invokeMethod('stop');
    } catch (e) {}
  }

  static Future<double> getBpm() async {
    try {
      return await _channel.invokeMethod('getBpm') ?? 120.0;
    } catch (e) {
      return 120.0;
    }
  }

  static Future<List<double>> getFFTData() async {
    try {
      final data = await _channel.invokeMethod('getFFTData');
      return List<double>.from(data ?? []);
    } catch (e) {
      return [];
    }
  }
}
