import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'native_bridge.dart';

enum AudioSource { none, microphone, file }

class AudioManager extends ChangeNotifier {
  AudioSource _source      = AudioSource.none;
  String?     _filePath;
  String?     _fileName;
  bool        _isPlaying   = false;
  bool        _initialized = false;

  AudioSource get source    => _source;
  String?     get filePath  => _filePath;
  String?     get fileName  => _fileName;
  bool        get isPlaying => _isPlaying;

  Future<void> _ensureInit() async {
    if (!_initialized) _initialized = await NativeBridge.init();
  }

  Future<bool> startMicrophone() async {
    final status = await Permission.microphone.request();
    if (!status.isGranted) return false;
    
    await _ensureInit();
    await NativeBridge.stop();
    final ok = await NativeBridge.startMicrophone();
    if (!ok) return false;
    
    _source = AudioSource.microphone; 
    _isPlaying = true;
    _filePath = null; // FIX: Zurücksetzen beim Mikrofon-Start
    _fileName = null; // FIX: Zurücksetzen beim Mikrofon-Start
    
    notifyListeners(); 
    return true;
  }

  Future<bool> pickAudioFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['mp3', 'wav', 'flac', 'aac', 'm4a'],
      allowMultiple: false,
    );
    
    if (result == null || result.files.isEmpty) return false;
    final file = result.files.first;
    if (file.path == null) return false;
    
    await _ensureInit();
    await NativeBridge.stop();
    
    final ok = await NativeBridge.startFilePlayback(file.path!);
    if (!ok) return false;
    
    _filePath = file.path; 
    _fileName = file.name;
    _source = AudioSource.file;
    _isPlaying = true;
    
    notifyListeners(); 
    return true;
  }

  Future<void> togglePlay() async {
    if (_isPlaying) {
      await NativeBridge.stop();
      _isPlaying = false;
    } else {
      if (_source == AudioSource.file && _filePath != null) {
        await NativeBridge.startFilePlayback(_filePath!);
        _isPlaying = true;
      } else if (_source == AudioSource.microphone) {
        await NativeBridge.startMicrophone();
        _isPlaying = true;
      }
    }
    notifyListeners();
  }

  Future<void> stop() async {
    await NativeBridge.stop();
    _isPlaying = false; 
    _source = AudioSource.none;
    _filePath = null;
    _fileName = null;
    notifyListeners();
  }
}