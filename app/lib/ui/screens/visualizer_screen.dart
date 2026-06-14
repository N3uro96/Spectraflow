import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import '../../core/audio_manager.dart';
import '../../core/audio_data_provider.dart';
import '../../core/seed_manager.dart';
import '../../core/dna_generator.dart';
import '../theme/sf_theme.dart';
import '../widgets/glass_container.dart';
import '../widgets/visualizer_widget.dart';

class VisualizerScreen extends StatelessWidget {
  const VisualizerScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final audio     = context.watch<AudioManager>();
    final audioData = context.read<AudioDataProvider>();
    final seeds     = context.watch<SeedManager>();
    final dna       = DNAGenerator.generate(seeds.currentSeed);

    return Scaffold(
      backgroundColor: SFTheme.background,
      body: Stack(
        children: [
          Positioned.fill(
            child: VisualizerWidget(audioData: audioData, dna: dna),
          ),
          SafeArea(
            child: Column(
              children: [
                _TopBar(audioData: audioData),
                const Spacer(),
                if (audio.fileName != null) _NowPlaying(audio: audio),
                _BottomPanel(audio: audio),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TopBar extends StatelessWidget {
  final AudioDataProvider audioData;
  const _TopBar({required this.audioData});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          Text('SPECTRAFLOW',
            style: SFTheme.labelSmall.copyWith(
              letterSpacing: 3.0, color: SFTheme.textPrimary)),
          const Spacer(),
          ListenableBuilder(
            listenable: audioData,
            builder: (_, __) => Row(children: [
              GlassContainer(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                borderRadius: SFTheme.radiusSm,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text('${audioData.bpm.toStringAsFixed(0)}',
                      style: SFTheme.titleMedium),
                  const SizedBox(width: 4),
                  Text('BPM', style: SFTheme.labelSmall),
                ]),
              ),
              const SizedBox(width: 10),
              GlassContainer(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                borderRadius: SFTheme.radiusSm,
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text('${(audioData.stereoWidth * 100).toStringAsFixed(0)}%',
                      style: SFTheme.titleMedium),
                  const SizedBox(width: 4),
                  Text('STEREO', style: SFTheme.labelSmall),
                ]),
              ),
            ]),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 600.ms);
  }
}

class _NowPlaying extends StatelessWidget {
  final AudioManager audio;
  const _NowPlaying({required this.audio});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: GlassContainer(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        borderRadius: SFTheme.radiusSm,
        child: Row(children: [
          Icon(
            audio.source == AudioSource.microphone
                ? Icons.mic_rounded : Icons.music_note_rounded,
            color: SFTheme.textPrimary, size: 16),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              audio.source == AudioSource.microphone
                  ? 'MICROPHONE INPUT' : audio.fileName ?? '',
              style: SFTheme.bodyMedium.copyWith(color: SFTheme.textPrimary),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          GestureDetector(
            onTap: audio.stop,
            child: Icon(Icons.close_rounded,
                color: SFTheme.textSecondary, size: 16)),
        ]),
      ),
    ).animate().fadeIn(duration: 300.ms);
  }
}

class _BottomPanel extends StatefulWidget {
  final AudioManager audio;
  const _BottomPanel({required this.audio});

  @override
  State<_BottomPanel> createState() => _BottomPanelState();
}

class _BottomPanelState extends State<_BottomPanel> {
  int _paletteIndex = 0;

  final List<Color> _paletteColors = [
    const Color(0xFF6C63FF), const Color(0xFFFF6584),
    const Color(0xFF43E97B), const Color(0xFFFA8231),
    const Color(0xFF00D2FF), const Color(0xFFFFD700),
  ];

  @override
  Widget build(BuildContext context) {
    final seeds = context.watch<SeedManager>();

    return Padding(
      padding: const EdgeInsets.all(20),
      child: GlassContainer(
        padding: const EdgeInsets.all(20),
        borderRadius: SFTheme.radiusLg,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Seed Anzeige + Würfel Button
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('SEED', style: SFTheme.labelSmall),
                    const SizedBox(height: 4),
                    Text(
                      '#${seeds.currentSeed}',
                      style: SFTheme.titleMedium.copyWith(
                        fontFamily: 'monospace',
                        letterSpacing: 2,
                      ),
                    ),
                  ],
                ),
                GestureDetector(
                  onTap: () => context.read<SeedManager>().randomize(),
                  child: GlassContainer(
                    padding: const EdgeInsets.all(14),
                    borderRadius: SFTheme.radiusSm,
                    child: Icon(
                      Icons.casino_rounded,
                      color: SFTheme.textPrimary,
                      size: 24,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _buildPaletteSelector(),
            const SizedBox(height: 24),
            _buildPlaybackControls(),
          ],
        ),
      ),
    ).animate()
      .slideY(begin: 0.3, end: 0, duration: 600.ms, curve: Curves.easeOutCubic)
      .fadeIn(duration: 600.ms);
  }

  Widget _buildPaletteSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('PALETTE', style: SFTheme.labelSmall),
        const SizedBox(height: 10),
        Row(
          children: List.generate(_paletteColors.length, (index) {
            final selected = index == _paletteIndex;
            return GestureDetector(
              onTap: () => setState(() => _paletteIndex = index),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.only(right: 10),
                width: selected ? 32 : 24,
                height: selected ? 32 : 24,
                decoration: BoxDecoration(
                  color: _paletteColors[index],
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: selected
                        ? Colors.white.withOpacity(0.8)
                        : Colors.transparent,
                    width: 2,
                  ),
                  boxShadow: selected ? [BoxShadow(
                    color: _paletteColors[index].withOpacity(0.6),
                    blurRadius: 12, spreadRadius: 2,
                  )] : null,
                ),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildPlaybackControls() {
    final audio = widget.audio;
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildControlButton(
          icon: audio.source == AudioSource.microphone
              ? Icons.mic_rounded : Icons.mic_none_rounded,
          label: 'MIC',
          active: audio.source == AudioSource.microphone,
          onTap: () async {
            if (audio.source == AudioSource.microphone) {
              await audio.stop();
            } else {
              await audio.startMicrophone();
            }
          },
        ),
        const SizedBox(width: 16),
        GestureDetector(
          onTap: audio.source == AudioSource.none ? null : audio.togglePlay,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 64, height: 64,
            decoration: BoxDecoration(
              color: SFTheme.glassAccent,
              shape: BoxShape.circle,
              border: Border.all(color: SFTheme.glassBorder, width: 0.5),
            ),
            child: Icon(
              audio.isPlaying ? Icons.stop_rounded : Icons.play_arrow_rounded,
              color: audio.source == AudioSource.none
                  ? SFTheme.textHint : SFTheme.textPrimary,
              size: 32,
            ),
          ),
        ),
        const SizedBox(width: 16),
        _buildControlButton(
          icon: Icons.folder_open_rounded,
          label: 'FILE',
          active: audio.source == AudioSource.file,
          onTap: () async => await audio.pickAudioFile(),
        ),
      ],
    );
  }

  Widget _buildControlButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool active = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: GlassContainer(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        borderRadius: SFTheme.radiusSm,
        color: active ? SFTheme.glassAccent : SFTheme.glass,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon,
              color: active ? SFTheme.textPrimary : SFTheme.textSecondary,
              size: 20),
            const SizedBox(height: 4),
            Text(label, style: SFTheme.labelSmall.copyWith(
              color: active ? SFTheme.textPrimary : SFTheme.textHint,
            )),
          ],
        ),
      ),
    );
  }
}
