package com.visitaloja.app

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp

/** Decorative only: preserves the official logo and never intercepts touch or focus. */
@Composable
fun BrandBackdrop(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    Box(modifier.clipToBounds().background(Brush.verticalGradient(listOf(Color(0xFFF0F7FF), Color(0xFFEAF2FC), Color(0xFFF6F4EC))))) {
        Box(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(Color(0x2278B9F3), Color.Transparent), radius = 900f)))
        Image(
            painter = painterResource(R.drawable.visitaloja_logo), contentDescription = null,
            modifier = Modifier.align(Alignment.CenterEnd).offset(x = 100.dp, y = 90.dp).size(420.dp).rotate(-12f),
            contentScale = ContentScale.Fit, alpha = 0.065f
        )
        content()
    }
}
