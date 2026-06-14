import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'core/audio_data_provider.dart';
import 'core/audio_manager.dart';
import 'ui/screens/visualizer_screen.dart';
import 'ui/theme/sf_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  runApp(const SpectraflowApp());
}

class SpectraflowApp extends StatelessWidget {
  const SpectraflowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AudioManager()),
        ChangeNotifierProvider(create: (_) {
          final provider = AudioDataProvider();
          provider.start();
          return provider;
        }),
      ],
      child: MaterialApp(
        title: 'Spectraflow',
        debugShowCheckedModeBanner: false,
        theme: SFTheme.theme,
        home: const VisualizerScreen(),
      ),
    );
  }
}
