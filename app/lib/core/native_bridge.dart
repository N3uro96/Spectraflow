import 'dart:typed_data';
import 'package:flutter/services.dart';

class NativeBridge {
  static const _method = MethodChannel('com.spectraflow.app/engine');
  static const _event  = EventChannel('com.spectraflow.app/audio_data');

  static Stream<Float64List> get audioStream =>
      _event.receiveBroadcastStream().map((dynamic data) {
        if (data is Float64List) return data;
        if (data is Float32List) return Float64List.fromList(data.toList());
        
        // Kugelsicherer Fallback, falls Kotlin/Flutter Zahlen als Ints komprimiert hat
        if (data is List) {
          final result = Float64List(data.length);
          for (int i = 0; i < data.length; i++) {
            result[i] = (data[i] as num).toDouble();
          }
          return result;
        }
        return Float64List(0);
      });

  static Future<bool> init() async {
    try { 
      return await _method.invokeMethod('init') ?? false;
    } catch (_) { 
      return false; 
    }
  }

  static Future<bool> startMicrophone() async {
    try { 
      return await _method.invokeMethod('startMicrophone') ?? false; 
    } catch (_) { 
      return false;
    }
  }

  static Future<bool> startFilePlayback(String path) async {
    try { 
      return await _method.invokeMethod('startFilePlayback', {'path': path}) ?? false; 
    } catch (_) { 
      return false;
    }
  }

  static Future<void> stop() async {
    try { 
      await _method.invokeMethod('stop');
    } catch (_) {}
  }
}