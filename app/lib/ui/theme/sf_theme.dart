import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class SFTheme {
  static const Color glass         = Color(0x14FFFFFF);
  static const Color glassBorder   = Color(0x26FFFFFF);
  static const Color glassAccent   = Color(0x33FFFFFF);
  static const Color textPrimary   = Color(0xE6FFFFFF);
  static const Color textSecondary = Color(0x73FFFFFF);
  static const Color textHint      = Color(0x40FFFFFF);
  static const Color background    = Color(0xFF050505);

  static TextStyle get displayLarge => GoogleFonts.inter(
    fontSize: 32, fontWeight: FontWeight.w200,
    color: textPrimary, letterSpacing: -0.5,
  );

  static TextStyle get titleMedium => GoogleFonts.inter(
    fontSize: 18, fontWeight: FontWeight.w300,
    color: textPrimary, letterSpacing: 0.2,
  );

  static TextStyle get bodyMedium => GoogleFonts.inter(
    fontSize: 14, fontWeight: FontWeight.w300,
    color: textSecondary, letterSpacing: 0.1,
  );

  static TextStyle get labelSmall => GoogleFonts.inter(
    fontSize: 11, fontWeight: FontWeight.w400,
    color: textHint, letterSpacing: 1.2,
  );

  static const double radiusSm = 8.0;
  static const double radiusMd = 16.0;
  static const double radiusLg = 24.0;
  static const double blur     = 12.0;

  static ThemeData get theme => ThemeData(
    brightness: Brightness.dark,
    scaffoldBackgroundColor: background,
    textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
  );
}
