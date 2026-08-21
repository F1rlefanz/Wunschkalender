package com.github.f1rlefanz.cf_alarmfortimeoffice.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.github.f1rlefanz.cf_alarmfortimeoffice.R

/**
 * Corporate-Design Typografie: Mulish für Überschriften, Roboto für UI/Fließtext
 * — dieselbe Paarung wie auf der Unternehmenswebsite.
 *
 * Setup (einmalig):
 * 1) Mulish-Schriftdateien von https://fonts.google.com/specimen/Mulish laden
 *    (Light, Regular, Medium, Bold) und als .ttf nach res/font/ legen:
 *      res/font/mulish_light.ttf
 *      res/font/mulish_regular.ttf
 *      res/font/mulish_medium.ttf
 *      res/font/mulish_bold.ttf
 *    (Dateinamen müssen lowercase + underscore sein, Android-Konvention.)
 * 2) Roboto ist auf so gut wie jedem Android-Gerät bereits als Systemfont
 *    vorinstalliert — dafür genügt FontFamily.Default, kein Bundling nötig.
 */
private val MulishFamily = FontFamily(
    Font(R.font.mulish_light, FontWeight.Light),
    Font(R.font.mulish_regular, FontWeight.Normal),
    Font(R.font.mulish_medium, FontWeight.Medium),
    Font(R.font.mulish_bold, FontWeight.Bold)
)

private val RobotoFamily = FontFamily.Default

val Typography = Typography(
    displayLarge = TextStyle(fontFamily = MulishFamily, fontWeight = FontWeight.Light, fontSize = 36.sp, lineHeight = 42.sp, letterSpacing = 0.sp),
    displayMedium = TextStyle(fontFamily = MulishFamily, fontWeight = FontWeight.Light, fontSize = 30.sp, lineHeight = 36.sp),

    headlineLarge = TextStyle(fontFamily = MulishFamily, fontWeight = FontWeight.Normal, fontSize = 26.sp, lineHeight = 32.sp),
    headlineMedium = TextStyle(fontFamily = MulishFamily, fontWeight = FontWeight.Normal, fontSize = 22.sp, lineHeight = 28.sp),

    titleLarge = TextStyle(fontFamily = MulishFamily, fontWeight = FontWeight.Medium, fontSize = 20.sp, lineHeight = 26.sp),
    titleMedium = TextStyle(fontFamily = RobotoFamily, fontWeight = FontWeight.Medium, fontSize = 16.sp, lineHeight = 22.sp, letterSpacing = 0.15.sp),
    titleSmall = TextStyle(fontFamily = RobotoFamily, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp, letterSpacing = 0.1.sp),

    bodyLarge = TextStyle(fontFamily = RobotoFamily, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 24.sp, letterSpacing = 0.5.sp),
    bodyMedium = TextStyle(fontFamily = RobotoFamily, fontWeight = FontWeight.Normal, fontSize = 14.sp, lineHeight = 20.sp, letterSpacing = 0.25.sp),
    bodySmall = TextStyle(fontFamily = RobotoFamily, fontWeight = FontWeight.Normal, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.4.sp),

    labelLarge = TextStyle(fontFamily = RobotoFamily, fontWeight = FontWeight.Medium, fontSize = 14.sp, lineHeight = 20.sp, letterSpacing = 0.1.sp),
    labelMedium = TextStyle(fontFamily = RobotoFamily, fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.5.sp),
    labelSmall = TextStyle(fontFamily = RobotoFamily, fontWeight = FontWeight.Medium, fontSize = 11.sp, lineHeight = 16.sp, letterSpacing = 0.5.sp)
)
