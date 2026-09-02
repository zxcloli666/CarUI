package com.caruiapp

object ReactActivityState {
    @Volatile
    var hasWindowFocus: Boolean = true

    @Volatile
    var isInForeground: Boolean = true
}
