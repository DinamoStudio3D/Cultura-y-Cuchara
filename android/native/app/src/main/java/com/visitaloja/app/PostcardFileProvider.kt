package com.visitaloja.app

import androidx.core.content.FileProvider

/** A dedicated provider avoids device-specific issues with declaring FileProvider directly. */
class PostcardFileProvider : FileProvider()
