package com.visitaloja.app

/** Device preference only; never changes account, business content or system locale. */
internal object LanguagePolicy {
    const val PREFERENCES = "visitaloja-presentation"
    const val KEY = "language"
    fun normalize(value: String?): String = if (value?.trim()?.lowercase(java.util.Locale.ROOT) == "en") "en" else "es"
    fun choose(english: Boolean): String = if (english) "en" else "es"
}
