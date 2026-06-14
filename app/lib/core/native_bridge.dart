import 'dart:typed_data';
import 'package:flutter/services.dart';

class NativeBridge {
  static const _method = MethodChannel('com.spectraflow.app/engine');
  static const _event  = EventChannel('com.spectraflow.app/audio_data');

  // FIX: Sicheres Casten der Kotlin-Daten in eine Float64List
  static Stream<Float64List> get audioStream =>
      _event.receiveBroadcastStream().map((data) {
        if (data is Float64List) return data;
        if (data is Float32List) return Float64List.fromList(data.toList());
        // Fallback: Wenn es als generische Liste (List<dynamic>) von Kotlin ankommt
        return Float64List.fromList((data as List<dynamic>).cast<double>());
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