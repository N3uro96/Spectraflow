import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:permission_handler/permission_handler.dart';

enum AudioSource { none, microphone, file }

class AudioManager extends ChangeNotifier {
  AudioSource _source     = AudioSource.none;
  String?     _filePath;
  String?     _fileName;
  bool        _isPlaying  = false;

  AudioSource get source    => _source;
  String?     get filePath  => _filePath;
  String?     get fileName  => _fileName;
  bool        get isPlaying => _isPlaying;

  // ─────────────────────────────────────────
  // Mikrofon
  // ─────────────────────────────────────────
  Future<bool> startMicrophone() async {
    final status = await Permission.microphone.request();
    if (!status.isGranted) return false;

    _source    = AudioSource.microphone;
    _isPlaying = true;
    _filePath  = null;
    _fileName  = null;
    notifyListeners();
    return true;
  }

  // ─────────────────────────────────────────
  // File Picker
  // ─────────────────────────────────────────
  Future<bool> pickAudioFile() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'],
      allowMultiple: false,
    );

    if (result == null || result.files.isEmpty) return false;

    final file = result.files.first;
    _filePath  = file.path;
    _fileName  = file.name;
    _source    = AudioSource.file;
    _isPlaying = true;
    notifyListeners();
    return true;
  }

  // ─────────────────────────────────────────
  // Play / Stop
  // ─────────────────────────────────────────
  void stop() {
    _isPlaying = false;
    _source    = AudioSource.none;
    notifyListeners();
  }

  void togglePlay() {
    _isPlaying = !_isPlaying;
    notifyListeners();
  }
}
