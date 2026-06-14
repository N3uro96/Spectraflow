import 'package:flutter/material.dart';

class SFPalette {
  final String name;
  final Color shadow;     // Stop 0 — dunkelster Ton
  final Color low;        // Stop 1
  final Color high;       // Stop 2
  final Color highlight;  // Stop 3 — hellster / lebendigster Ton

  const SFPalette({
    required this.name,
    required this.shadow,
    required this.low,
    required this.high,
    required this.highlight,
  });

  // UI-Akzentfarbe (z.B. für Buttons)
  Color get accent => highlight;
}

// ─────────────────────────────────────────────────────────────
// 64 Paletten  |  Gruppe 1 (0–31): Organisch
//              |  Gruppe 2 (32–63): Digital / Neon
// ─────────────────────────────────────────────────────────────
const List<SFPalette> kPalettes = [

  // ── Gruppe 1: Organisch ──────────────────────────────────

  SFPalette(name: 'Sunset',
    shadow:    Color(0xFF1A0A00),
    low:       Color(0xFF8B2500),
    high:      Color(0xFFFF6B35),
    highlight: Color(0xFFFFE66D)),

  SFPalette(name: 'Ocean',
    shadow:    Color(0xFF001220),
    low:       Color(0xFF003F7F),
    high:      Color(0xFF0096C7),
    highlight: Color(0xFF90E0EF)),

  SFPalette(name: 'Forest',
    shadow:    Color(0xFF0A1A00),
    low:       Color(0xFF1B4332),
    high:      Color(0xFF52B788),
    highlight: Color(0xFFD8F3DC)),

  SFPalette(name: 'Desert',
    shadow:    Color(0xFF1A0E00),
    low:       Color(0xFF7B4F1E),
    high:      Color(0xFFE07B39),
    highlight: Color(0xFFF5C842)),

  SFPalette(name: 'Aurora',
    shadow:    Color(0xFF000A1A),
    low:       Color(0xFF023E8A),
    high:      Color(0xFF00B4D8),
    highlight: Color(0xFF90E0EF)),

  SFPalette(name: 'Lavender',
    shadow:    Color(0xFF100020),
    low:       Color(0xFF4A1D96),
    high:      Color(0xFFA78BFA),
    highlight: Color(0xFFEDE9FE)),

  SFPalette(name: 'Autumn',
    shadow:    Color(0xFF1A0500),
    low:       Color(0xFF7C2D12),
    high:      Color(0xFFEA580C),
    highlight: Color(0xFFFCD34D)),

  SFPalette(name: 'Arctic',
    shadow:    Color(0xFF001030),
    low:       Color(0xFF1E3A5F),
    high:      Color(0xFF5BA4CF),
    highlight: Color(0xFFE0F4FF)),

  SFPalette(name: 'Volcano',
    shadow:    Color(0xFF1A0000),
    low:       Color(0xFF7F1D1D),
    high:      Color(0xFFEF4444),
    highlight: Color(0xFFFDE68A)),

  SFPalette(name: 'Rose',
    shadow:    Color(0xFF1A000A),
    low:       Color(0xFF881337),
    high:      Color(0xFFFB7185),
    highlight: Color(0xFFFFE4E6)),

  SFPalette(name: 'Jade',
    shadow:    Color(0xFF001A10),
    low:       Color(0xFF064E3B),
    high:      Color(0xFF34D399),
    highlight: Color(0xFFD1FAE5)),

  SFPalette(name: 'Copper',
    shadow:    Color(0xFF150800),
    low:       Color(0xFF7C3E0B),
    high:      Color(0xFFCD7F32),
    highlight: Color(0xFFF5D08A)),

  SFPalette(name: 'Dusk',
    shadow:    Color(0xFF0A0020),
    low:       Color(0xFF312E81),
    high:      Color(0xFFEC4899),
    highlight: Color(0xFFFDE68A)),

  SFPalette(name: 'Moss',
    shadow:    Color(0xFF0A0F00),
    low:       Color(0xFF3D5A1E),
    high:      Color(0xFF86A84E),
    highlight: Color(0xFFD4E09B)),

  SFPalette(name: 'Coral',
    shadow:    Color(0xFF1A0510),
    low:       Color(0xFF881337),
    high:      Color(0xFFF97316),
    highlight: Color(0xFFFED7AA)),

  SFPalette(name: 'Midnight',
    shadow:    Color(0xFF00001A),
    low:       Color(0xFF1E1B4B),
    high:      Color(0xFF4F46E5),
    highlight: Color(0xFFC7D2FE)),

  SFPalette(name: 'Amber',
    shadow:    Color(0xFF1A0A00),
    low:       Color(0xFF78350F),
    high:      Color(0xFFD97706),
    highlight: Color(0xFFFDE68A)),

  SFPalette(name: 'Sage',
    shadow:    Color(0xFF061208),
    low:       Color(0xFF1A3B20),
    high:      Color(0xFF6B9E72),
    highlight: Color(0xFFD9EAD3)),

  SFPalette(name: 'Clay',
    shadow:    Color(0xFF1A0800),
    low:       Color(0xFF7C2D12),
    high:      Color(0xFFC2714B),
    highlight: Color(0xFFF5CBA7)),

  SFPalette(name: 'Peacock',
    shadow:    Color(0xFF001520),
    low:       Color(0xFF0C4A6E),
    high:      Color(0xFF0EA5E9),
    highlight: Color(0xFFBAE6FD)),

  SFPalette(name: 'Mango',
    shadow:    Color(0xFF1A0800),
    low:       Color(0xFF7C2D12),
    high:      Color(0xFFF59E0B),
    highlight: Color(0xFFFEF08A)),

  SFPalette(name: 'Plum',
    shadow:    Color(0xFF12001A),
    low:       Color(0xFF4C1D95),
    high:      Color(0xFFA21CAF),
    highlight: Color(0xFFF5D0FE)),

  SFPalette(name: 'Cerulean',
    shadow:    Color(0xFF000E1A),
    low:       Color(0xFF0C4A6E),
    high:      Color(0xFF3B82F6),
    highlight: Color(0xFFBFDBFE)),

  SFPalette(name: 'Fern',
    shadow:    Color(0xFF061A00),
    low:       Color(0xFF14532D),
    high:      Color(0xFF4ADE80),
    highlight: Color(0xFFDCFCE7)),

  SFPalette(name: 'Mahogany',
    shadow:    Color(0xFF150500),
    low:       Color(0xFF6B1A0D),
    high:      Color(0xFFB45309),
    highlight: Color(0xFFF3C26A)),

  SFPalette(name: 'Sapphire',
    shadow:    Color(0xFF00001A),
    low:       Color(0xFF1E3A8A),
    high:      Color(0xFF2563EB),
    highlight: Color(0xFF93C5FD)),

  SFPalette(name: 'Blossom',
    shadow:    Color(0xFF1A0010),
    low:       Color(0xFF831843),
    high:      Color(0xFFEC4899),
    highlight: Color(0xFFFDF2F8)),

  SFPalette(name: 'Obsidian',
    shadow:    Color(0xFF0A0A0A),
    low:       Color(0xFF374151),
    high:      Color(0xFF9CA3AF),
    highlight: Color(0xFFF3F4F6)),

  SFPalette(name: 'Cinnamon',
    shadow:    Color(0xFF150500),
    low:       Color(0xFF7C2D12),
    high:      Color(0xFFC2410C),
    highlight: Color(0xFFFED7AA)),

  SFPalette(name: 'Turquoise',
    shadow:    Color(0xFF001515),
    low:       Color(0xFF134E4A),
    high:      Color(0xFF14B8A6),
    highlight: Color(0xFFCCFBF1)),

  SFPalette(name: 'Maroon',
    shadow:    Color(0xFF1A0000),
    low:       Color(0xFF7F1D1D),
    high:      Color(0xFFDC2626),
    highlight: Color(0xFFFECACA)),

  SFPalette(name: 'Olive',
    shadow:    Color(0xFF0A0F00),
    low:       Color(0xFF365314),
    high:      Color(0xFF84CC16),
    highlight: Color(0xFFECFCCB)),

  // ── Gruppe 2: Digital / Neon ─────────────────────────────

  SFPalette(name: 'Neon Pink',
    shadow:    Color(0xFF0A0010),
    low:       Color(0xFF4C0070),
    high:      Color(0xFFE040FB),
    highlight: Color(0xFFFFB3FF)),

  SFPalette(name: 'Cyber Teal',
    shadow:    Color(0xFF000A0A),
    low:       Color(0xFF003333),
    high:      Color(0xFF00E5FF),
    highlight: Color(0xFFCCFFFF)),

  SFPalette(name: 'Matrix',
    shadow:    Color(0xFF000A00),
    low:       Color(0xFF003300),
    high:      Color(0xFF00C853),
    highlight: Color(0xFFB9F6CA)),

  SFPalette(name: 'Vaporwave',
    shadow:    Color(0xFF100020),
    low:       Color(0xFF6B21A8),
    high:      Color(0xFFEC4899),
    highlight: Color(0xFF67E8F9)),

  SFPalette(name: 'Electric Blue',
    shadow:    Color(0xFF00000A),
    low:       Color(0xFF1E1B4B),
    high:      Color(0xFF2979FF),
    highlight: Color(0xFFBBDEFB)),

  SFPalette(name: 'Lava',
    shadow:    Color(0xFF0A0000),
    low:       Color(0xFF450A0A),
    high:      Color(0xFFFF1744),
    highlight: Color(0xFFFF8A65)),

  SFPalette(name: 'Toxic',
    shadow:    Color(0xFF000A00),
    low:       Color(0xFF1A3300),
    high:      Color(0xFF76FF03),
    highlight: Color(0xFFE6FF8A)),

  SFPalette(name: 'Glitch',
    shadow:    Color(0xFF05000A),
    low:       Color(0xFF2D0D42),
    high:      Color(0xFF7C4DFF),
    highlight: Color(0xFFEA80FC)),

  SFPalette(name: 'Nuclear',
    shadow:    Color(0xFF0A0A00),
    low:       Color(0xFF3D3300),
    high:      Color(0xFFFFD600),
    highlight: Color(0xFFFFF176)),

  SFPalette(name: 'Ultraviolet',
    shadow:    Color(0xFF05000A),
    low:       Color(0xFF3B0764),
    high:      Color(0xFF9333EA),
    highlight: Color(0xFFD8B4FE)),

  SFPalette(name: 'Arcade',
    shadow:    Color(0xFF000A1A),
    low:       Color(0xFF1E1B4B),
    high:      Color(0xFFD500F9),
    highlight: Color(0xFF18FFFF)),

  SFPalette(name: 'Hologram',
    shadow:    Color(0xFF000A0A),
    low:       Color(0xFF0C4A6E),
    high:      Color(0xFF00B0FF),
    highlight: Color(0xFFE1F5FE)),

  SFPalette(name: 'Plasma',
    shadow:    Color(0xFF100020),
    low:       Color(0xFF4A0080),
    high:      Color(0xFFAA00FF),
    highlight: Color(0xFFEA80FC)),

  SFPalette(name: 'Synthwave',
    shadow:    Color(0xFF0A0020),
    low:       Color(0xFF4C1D95),
    high:      Color(0xFFDB2777),
    highlight: Color(0xFFF0ABFC)),

  SFPalette(name: 'Acid',
    shadow:    Color(0xFF050A00),
    low:       Color(0xFF1A2E00),
    high:      Color(0xFF64DD17),
    highlight: Color(0xFFEEFF41)),

  SFPalette(name: 'Binary',
    shadow:    Color(0xFF000000),
    low:       Color(0xFF263238),
    high:      Color(0xFF78909C),
    highlight: Color(0xFFECEFF1)),

  SFPalette(name: 'Circuit',
    shadow:    Color(0xFF000A00),
    low:       Color(0xFF052E16),
    high:      Color(0xFF00C853),
    highlight: Color(0xFFFFD700)),

  SFPalette(name: 'Laser',
    shadow:    Color(0xFF0A0000),
    low:       Color(0xFF450A0A),
    high:      Color(0xFFFF1744),
    highlight: Color(0xFFFF8A80)),

  SFPalette(name: 'Disco',
    shadow:    Color(0xFF050010),
    low:       Color(0xFF1E1B4B),
    high:      Color(0xFFDB2777),
    highlight: Color(0xFFFDE68A)),

  SFPalette(name: 'Quantum',
    shadow:    Color(0xFF00050A),
    low:       Color(0xFF0C2340),
    high:      Color(0xFF0288D1),
    highlight: Color(0xFF67E8F9)),

  SFPalette(name: 'Reactor',
    shadow:    Color(0xFF0A0500),
    low:       Color(0xFF451A00),
    high:      Color(0xFFF97316),
    highlight: Color(0xFFFEF08A)),

  SFPalette(name: 'Ghost',
    shadow:    Color(0xFF05050A),
    low:       Color(0xFF1E1E2E),
    high:      Color(0xFF6C7086),
    highlight: Color(0xFFCDD6F4)),

  SFPalette(name: 'Neon Orange',
    shadow:    Color(0xFF0A0500),
    low:       Color(0xFF431407),
    high:      Color(0xFFFF6D00),
    highlight: Color(0xFFFFFF00)),

  SFPalette(name: 'Chrome',
    shadow:    Color(0xFF0A0A0A),
    low:       Color(0xFF1F2937),
    high:      Color(0xFF6B7280),
    highlight: Color(0xFFF9FAFB)),

  SFPalette(name: 'Radioactive',
    shadow:    Color(0xFF000A00),
    low:       Color(0xFF052E16),
    high:      Color(0xFF00E676),
    highlight: Color(0xFFCCFF90)),

  SFPalette(name: 'Cyberpunk',
    shadow:    Color(0xFF050010),
    low:       Color(0xFF1A0050),
    high:      Color(0xFF00E5FF),
    highlight: Color(0xFFE040FB)),

  SFPalette(name: 'Virus',
    shadow:    Color(0xFF050000),
    low:       Color(0xFF3D0000),
    high:      Color(0xFF00E676),
    highlight: Color(0xFFFF1744)),

  SFPalette(name: 'Supernova',
    shadow:    Color(0xFF050010),
    low:       Color(0xFF2D0070),
    high:      Color(0xFFFF6D00),
    highlight: Color(0xFFFFFFFF)),

  SFPalette(name: 'Prism',
    shadow:    Color(0xFF000000),
    low:       Color(0xFF1E1B4B),
    high:      Color(0xFFDC2626),
    highlight: Color(0xFFFFFFFF)),

  SFPalette(name: 'Signal',
    shadow:    Color(0xFF000005),
    low:       Color(0xFF0C0A3E),
    high:      Color(0xFF2979FF),
    highlight: Color(0xFF82B1FF)),

  SFPalette(name: 'Storm',
    shadow:    Color(0xFF05050A),
    low:       Color(0xFF1C1C2E),
    high:      Color(0xFF4C566A),
    highlight: Color(0xFFECEFF4)),

  SFPalette(name: 'Retro',
    shadow:    Color(0xFF150A00),
    low:       Color(0xFF5C3317),
    high:      Color(0xFFD4762A),
    highlight: Color(0xFFF5DEB3)),
];
