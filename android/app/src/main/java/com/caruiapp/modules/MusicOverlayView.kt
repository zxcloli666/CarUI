package com.caruiapp.modules

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.RenderEffect
import android.graphics.Shader
import android.graphics.drawable.Drawable
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewOutlineProvider
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.caruiapp.R
import kotlin.math.roundToInt

data class CustomActionInfo(
    val id: String,
    val icon: Drawable?,
    val isActive: Boolean
)

class MusicOverlayView(
    context: Context,
    baseWidthPx: Int,
    baseHeightPx: Int
) : FrameLayout(context) {
    private val density = resources.displayMetrics.density
    private val accentColor = Color.parseColor("#7C8CFF")
    private val textPrimary = Color.parseColor("#F5F7FF")
    private val textSecondary = Color.parseColor("#9BA0B3")

    private val contentRoot: FrameLayout
    private val backgroundArt: ImageView
    private val albumArtView: ImageView
    private val albumArtCollapsed: ImageView
    private val titleView: TextView
    private val artistView: TextView
    private val positionLabel: TextView
    private val durationLabel: TextView
    private val progressFill: View
    private val customActionsRow: LinearLayout
    private val playPauseMain: ImageView
    private val playPauseCollapsed: ImageView
    private val collapsedTitle: TextView
    private val expandedGroup: View
    private val collapsedGroup: View
    private val collapseButton: ImageView
    private val expandButton: ImageView

    val dragHandle: View
    val collapsedHandle: View
    val resizeHandle: View

    var onPlayPause: (() -> Unit)? = null
    var onNext: (() -> Unit)? = null
    var onPrev: (() -> Unit)? = null
    var onToggleCollapse: (() -> Unit)? = null
    var onCustomAction: ((String) -> Unit)? = null

    private var lastProgress = 0L
    private var lastDuration = 0L

    init {
        contentRoot = FrameLayout(context).apply {
            layoutParams = LayoutParams(baseWidthPx, baseHeightPx)
            clipToOutline = true
            outlineProvider = object : ViewOutlineProvider() {
                override fun getOutline(view: View, outline: android.graphics.Outline) {
                    outline.setRoundRect(0, 0, view.width, view.height, dp(26).toFloat())
                }
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(26).toFloat()
                setColor(Color.parseColor("#D0121420"))
                setStroke(dp(1), Color.parseColor("#2AFFFFFF"))
            }
        }
        addView(contentRoot)

        backgroundArt = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            alpha = 0.32f
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            backgroundArt.setRenderEffect(RenderEffect.createBlurEffect(36f, 36f, Shader.TileMode.CLAMP))
        }
        contentRoot.addView(backgroundArt, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        val glassOverlay = View(context).apply {
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(
                    Color.parseColor("#25FFFFFF"),
                    Color.parseColor("#10FFFFFF"),
                    Color.parseColor("#2A000000")
                )
            )
        }
        contentRoot.addView(glassOverlay, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        val content = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(18))
        }
        contentRoot.addView(content, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        expandedGroup = content

        val artContainer = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, dp(210))
        }
        albumArtView = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(18).toFloat()
                setColor(Color.parseColor("#1AFFFFFF"))
            }
            clipToOutline = true
        }
        artContainer.addView(albumArtView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))

        collapseButton = ImageView(context).apply {
            setImageDrawable(ContextCompat.getDrawable(context, R.drawable.ic_chevron_down))
            setColorFilter(Color.WHITE)
            scaleType = ImageView.ScaleType.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#26FFFFFF"))
                setStroke(dp(1), Color.parseColor("#33FFFFFF"))
            }
            setPadding(dp(8), dp(8), dp(8), dp(8))
            setOnClickListener { onToggleCollapse?.invoke() }
        }
        val collapseParams = LayoutParams(dp(32), dp(32), Gravity.END or Gravity.TOP).apply {
            topMargin = dp(10)
            rightMargin = dp(10)
        }
        artContainer.addView(collapseButton, collapseParams)

        content.addView(artContainer)
        dragHandle = artContainer

        titleView = TextView(context).apply {
            setTextColor(textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        }
        val titleParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(12)
        }
        content.addView(titleView, titleParams)

        artistView = TextView(context).apply {
            setTextColor(textSecondary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        }
        val artistParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(4)
        }
        content.addView(artistView, artistParams)

        val progressBox = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
        }
        val progressParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(16)
        }
        content.addView(progressBox, progressParams)

        val track = FrameLayout(context).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(4).toFloat()
                setColor(Color.parseColor("#26FFFFFF"))
            }
        }
        progressBox.addView(track, LayoutParams(LayoutParams.MATCH_PARENT, dp(6)))

        progressFill = View(context).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(4).toFloat()
                setColor(accentColor)
            }
        }
        track.addView(progressFill, LayoutParams(0, LayoutParams.MATCH_PARENT))
        track.addOnLayoutChangeListener { _, _, _, _, _, _, _, _, _ ->
            updateProgressInternal(lastProgress, lastDuration)
        }

        val timeRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val timeParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(6)
        }
        progressBox.addView(timeRow, timeParams)

        positionLabel = TextView(context).apply {
            setTextColor(Color.parseColor("#80FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        }
        durationLabel = TextView(context).apply {
            setTextColor(Color.parseColor("#80FFFFFF"))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        }
        val spacer = View(context)
        timeRow.addView(positionLabel)
        timeRow.addView(spacer, LinearLayout.LayoutParams(0, 0, 1f))
        timeRow.addView(durationLabel)

        customActionsRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        val customParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(14)
        }
        content.addView(customActionsRow, customParams)

        val mainControls = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        val mainParams = LinearLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT).apply {
            topMargin = dp(18)
        }
        content.addView(mainControls, mainParams)

        val prevButton = createMainButton(R.drawable.ic_music_prev, false)
        playPauseMain = createMainButton(R.drawable.ic_music_play, true)
        val nextButton = createMainButton(R.drawable.ic_music_next, false)
        prevButton.setOnClickListener { onPrev?.invoke() }
        playPauseMain.setOnClickListener { onPlayPause?.invoke() }
        nextButton.setOnClickListener { onNext?.invoke() }
        mainControls.addView(prevButton)
        mainControls.addView(playPauseMain)
        mainControls.addView(nextButton)

        resizeHandle = View(context).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.RECTANGLE
                cornerRadius = dp(14).toFloat()
                setColor(Color.parseColor("#33FFFFFF"))
                setStroke(dp(1), Color.parseColor("#44FFFFFF"))
            }
        }
        val resizeParams = LayoutParams(dp(66), dp(66), Gravity.END or Gravity.BOTTOM).apply {
            rightMargin = dp(12)
            bottomMargin = dp(12)
        }
        contentRoot.addView(resizeHandle, resizeParams)

        val collapsed = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(14), dp(10), dp(14), dp(10))
            visibility = View.GONE
        }
        collapsedHandle = collapsed
        contentRoot.addView(collapsed, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
        collapsedGroup = collapsed

        albumArtCollapsed = ImageView(context).apply {
            scaleType = ImageView.ScaleType.CENTER_CROP
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#1AFFFFFF"))
            }
            clipToOutline = true
        }
        collapsed.addView(albumArtCollapsed, LinearLayout.LayoutParams(dp(34), dp(34)))

        collapsedTitle = TextView(context).apply {
            setTextColor(textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
        }
        val collapsedTitleParams = LinearLayout.LayoutParams(0, LayoutParams.WRAP_CONTENT, 1f).apply {
            leftMargin = dp(10)
        }
        collapsed.addView(collapsedTitle, collapsedTitleParams)

        playPauseCollapsed = createSmallButton(R.drawable.ic_music_play)
        playPauseCollapsed.setOnClickListener { onPlayPause?.invoke() }
        collapsed.addView(playPauseCollapsed)

        expandButton = createSmallButton(R.drawable.ic_chevron_up)
        expandButton.setOnClickListener { onToggleCollapse?.invoke() }
        collapsed.addView(expandButton)

        setMetadata("", "", null)
        setPlayback(false)
        setProgress(0L, 0L)
    }

    fun setScaleFactor(scale: Float) {
        contentRoot.pivotX = 0f
        contentRoot.pivotY = 0f
        contentRoot.scaleX = scale
        contentRoot.scaleY = scale
    }

    fun setContainerSize(width: Int, height: Int) {
        val params = contentRoot.layoutParams as LayoutParams
        params.width = width
        params.height = height
        contentRoot.layoutParams = params
    }

    fun setMetadata(title: String, artist: String, artwork: Bitmap?) {
        val safeTitle = if (title.isBlank()) "Music" else title
        titleView.text = safeTitle
        collapsedTitle.text = safeTitle
        artistView.text = if (artist.isBlank()) " " else artist
        if (artwork != null) {
            albumArtView.setImageBitmap(artwork)
            albumArtCollapsed.setImageBitmap(artwork)
            backgroundArt.setImageBitmap(artwork)
        } else {
            albumArtView.setImageDrawable(null)
            albumArtCollapsed.setImageDrawable(null)
            backgroundArt.setImageDrawable(null)
        }
    }

    fun setPlayback(isPlaying: Boolean) {
        val iconRes = if (isPlaying) R.drawable.ic_music_pause else R.drawable.ic_music_play
        playPauseMain.setImageDrawable(ContextCompat.getDrawable(context, iconRes))
        playPauseCollapsed.setImageDrawable(ContextCompat.getDrawable(context, iconRes))
    }

    fun setProgress(positionMs: Long, durationMs: Long) {
        lastProgress = positionMs
        lastDuration = durationMs
        updateProgressInternal(positionMs, durationMs)
        positionLabel.text = formatTime(positionMs)
        durationLabel.text = formatTime(durationMs)
    }

    fun setCustomActions(actions: List<CustomActionInfo>) {
        customActionsRow.removeAllViews()
        if (actions.isEmpty()) {
            customActionsRow.visibility = View.GONE
            return
        }
        customActionsRow.visibility = View.VISIBLE
        actions.take(5).forEach { action ->
            val button = ImageView(context).apply {
                val size = dp(46)
                layoutParams = LinearLayout.LayoutParams(size, size).apply {
                    rightMargin = dp(12)
                }
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#1FFFFFFF"))
                    setStroke(dp(1), Color.parseColor("#33FFFFFF"))
                }
                setPadding(dp(10), dp(10), dp(10), dp(10))
                scaleType = ImageView.ScaleType.CENTER_INSIDE
                if (action.icon != null) {
                    setImageDrawable(action.icon)
                    setColorFilter(if (action.isActive) accentColor else Color.WHITE)
                } else {
                    setImageDrawable(ContextCompat.getDrawable(context, R.drawable.ic_music_play))
                    setColorFilter(Color.WHITE)
                }
                setOnClickListener { onCustomAction?.invoke(action.id) }
            }
            customActionsRow.addView(button)
        }
    }

    fun setCollapsed(collapsed: Boolean) {
        expandedGroup.visibility = if (collapsed) View.GONE else View.VISIBLE
        collapsedGroup.visibility = if (collapsed) View.VISIBLE else View.GONE
        resizeHandle.visibility = if (collapsed) View.GONE else View.VISIBLE
        collapseButton.visibility = if (collapsed) View.GONE else View.VISIBLE
    }

    private fun updateProgressInternal(positionMs: Long, durationMs: Long) {
        val track = progressFill.parent as? View ?: return
        val width = track.width
        if (width <= 0) return
        val progress = if (durationMs > 0L) {
            (positionMs.toFloat() / durationMs.toFloat()).coerceIn(0f, 1f)
        } else {
            0f
        }
        val params = progressFill.layoutParams
        params.width = (width * progress).toInt()
        progressFill.layoutParams = params
    }

    private fun createMainButton(iconRes: Int, primary: Boolean): ImageView {
        return ImageView(context).apply {
            val size = dp(if (primary) 84 else 62)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                rightMargin = dp(22)
            }
            scaleType = ImageView.ScaleType.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(if (primary) accentColor else Color.parseColor("#22FFFFFF"))
                setStroke(dp(1), Color.parseColor("#33FFFFFF"))
            }
            setPadding(dp(16), dp(16), dp(16), dp(16))
            setImageDrawable(ContextCompat.getDrawable(context, iconRes))
            setColorFilter(Color.WHITE)
        }
    }

    private fun createSmallButton(iconRes: Int): ImageView {
        return ImageView(context).apply {
            val size = dp(32)
            layoutParams = LinearLayout.LayoutParams(size, size).apply {
                leftMargin = dp(8)
            }
            scaleType = ImageView.ScaleType.CENTER
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#22FFFFFF"))
                setStroke(dp(1), Color.parseColor("#33FFFFFF"))
            }
            setPadding(dp(6), dp(6), dp(6), dp(6))
            setImageDrawable(ContextCompat.getDrawable(context, iconRes))
            setColorFilter(Color.WHITE)
        }
    }

    private fun formatTime(ms: Long): String {
        if (ms <= 0L) return "0:00"
        val totalSec = (ms / 1000).toInt()
        val min = totalSec / 60
        val sec = totalSec % 60
        return if (sec < 10) "$min:0$sec" else "$min:$sec"
    }

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).roundToInt()
    }
}
