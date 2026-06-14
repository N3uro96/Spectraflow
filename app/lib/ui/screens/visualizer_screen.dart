import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../theme/sf_theme.dart';
import '../widgets/glass_container.dart';
import '../widgets/shader_canvas.dart';

class VisualizerScreen extends StatefulWidget {
  const VisualizerScreen({super.key});

  @override
  State<VisualizerScreen> createState() => _VisualizerScreenState();
}

class _VisualizerScreenState extends State<VisualizerScreen> {
  double _bpm         = 128.0;
  double _stereo      = 0.85;
  int    _shaderIndex  = 0;
  int    _paletteIndex = 0;
  bool   _isPlaying   = false;

  final List<String> _shaderNames = [
    'NEBULA', 'VORTEX', 'FRACTAL', 'PLASMA',
    'CRYSTAL', 'AURORA', 'WARP', 'PRISM',
  ];

  final List<Color> _paletteColors = [
    const Color(0xFF6C63FF),
    const Color(0xFFFF6584),
    const Color(0xFF43E97B),
    const Color(0xFFFA8231),
    const Color(0xFF00D2FF),
    const Color(0xFFFFD700),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SFTheme.background,
      body: Stack(
        children: [
          const Positioned.fill(child: ShaderCanvas()),
          SafeArea(
            child: Column(
              children: [
                _buildTopBar(),
                const Spacer(),
                _buildBottomPanel(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        children: [
          Text('SPECTRAFLOW',
            style: SFTheme.labelSmall.copyWith(
              letterSpacing: 3.0, color: SFTheme.textPrimary,
            ),
          ),
          const Spacer(),
          GlassContainer(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            borderRadius: SFTheme.radiusSm,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text('${_bpm.toStringAsFixed(0)}', style: SFTheme.titleMedium),
              const SizedBox(width: 4),
              Text('BPM', style: SFTheme.labelSmall),
            ]),
          ),
          const SizedBox(width: 10),
          GlassContainer(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            borderRadius: SFTheme.radiusSm,
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Text('${(_stereo * 100).toStringAsFixed(0)}%',
                  style: SFTheme.titleMedium),
              const SizedBox(width: 4),
              Text('STEREO', style: SFTheme.labelSmall),
            ]),
          ),
        ],
      ),
    ).animate().fadeIn(duration: 600.ms);
  }

  Widget _buildBottomPanel() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: GlassContainer(
        padding: const EdgeInsets.all(20),
        borderRadius: SFTheme.radiusLg,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildShaderSelector(),
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

  Widget _buildShaderSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('SHADER', style: SFTheme.labelSmall),
        const SizedBox(height: 10),
        SizedBox(
          height: 36,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            itemCount: _shaderNames.length,
            separatorBuilder: (_, __) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final selected = index == _shaderIndex;
              return GestureDetector(
                onTap: () => setState(() => _shaderIndex = index),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 200),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: selected ? SFTheme.glassAccent : Colors.transparent,
                    borderRadius: BorderRadius.circular(SFTheme.radiusSm),
                    border: Border.all(
                      color: selected ? SFTheme.glassBorder : Colors.transparent,
                      width: 0.5,
                    ),
                  ),
                  child: Text(_shaderNames[index],
                    style: SFTheme.labelSmall.copyWith(
                      color: selected ? SFTheme.textPrimary : SFTheme.textSecondary,
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
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
                  boxShadow: selected ? [
                    BoxShadow(
                      color: _paletteColors[index].withOpacity(0.6),
                      blurRadius: 12, spreadRadius: 2,
                    )
                  ] : null,
                ),
              ),
            );
          }),
        ),
      ],
    );
  }

  Widget _buildPlaybackControls() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildControlButton(icon: Icons.mic_none_rounded, label: 'MIC', onTap: () {}),
        const SizedBox(width: 16),
        GestureDetector(
          onTap: () => setState(() => _isPlaying = !_isPlaying),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 64, height: 64,
            decoration: BoxDecoration(
              color: SFTheme.glassAccent,
              shape: BoxShape.circle,
              border: Border.all(color: SFTheme.glassBorder, width: 0.5),
            ),
            child: Icon(
              _isPlaying ? Icons.stop_rounded : Icons.play_arrow_rounded,
              color: SFTheme.textPrimary, size: 32,
            ),
          ),
        ),
        const SizedBox(width: 16),
        _buildControlButton(icon: Icons.shuffle_rounded, label: 'SEED', onTap: () {}),
      ],
    );
  }

  Widget _buildControlButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: GlassContainer(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        borderRadius: SFTheme.radiusSm,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: SFTheme.textPrimary, size: 20),
            const SizedBox(height: 4),
            Text(label, style: SFTheme.labelSmall),
          ],
        ),
      ),
    );
  }
}
