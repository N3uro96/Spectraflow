import 'package:flutter/foundation.dart';

const List<String> kShaderPaths = [
  'lib/shaders/tunnel.frag',
  'lib/shaders/particles.frag',
  'lib/shaders/kaleidoscope.frag',
  'lib/shaders/chessboard.frag',
];

const List<String> kShaderNames = [
  'Tunnel',
  'Particles',
  'Kaleidoscope',
  'Chessboard',
];

class ShaderManager extends ChangeNotifier {
  int _index = 0;

  int    get index => _index;
  String get name  => kShaderNames[_index];
  String get path  => kShaderPaths[_index];
  int    get count => kShaderPaths.length;

  void next() {
    _index = (_index + 1) % kShaderPaths.length;
    notifyListeners();
  }

  void prev() {
    _index = (_index - 1 + kShaderPaths.length) % kShaderPaths.length;
    notifyListeners();
  }

  void select(int i) {
    _index = i % kShaderPaths.length;
    notifyListeners();
  }
}
