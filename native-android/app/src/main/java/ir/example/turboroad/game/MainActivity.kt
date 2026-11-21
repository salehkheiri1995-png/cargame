package ir.example.turboroad.game

import android.annotation.SuppressLint
import android.app.Activity
import android.graphics.Color
import android.opengl.GLSurfaceView
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.FrameLayout
import android.widget.TextView

class MainActivity : Activity() {

    private lateinit var glView: GLSurfaceView
    private val renderer = GameRenderer()
    private lateinit var hud: TextView

    @SuppressLint("ClickableViewAccessibility")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        glView = GLSurfaceView(this).apply {
            setEGLContextClientVersion(3)
            setRenderer(renderer)
            setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY)
            setOnTouchListener { _, event -> handleTouch(event); true }
        }
        setContentView(glView)

        hud = TextView(this).apply {
            textSize = 17f
            setTextColor(Color.rgb(234, 246, 255))
            setShadowLayer(6f, 0f, 0f, Color.BLACK)
            setPadding(48, 48, 48, 48)
            gravity = Gravity.TOP or Gravity.START
        }
        renderer.hudUpdater = { hud.text = it }
        addContentView(
            hud,
            FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)
        )

        applyImmersive()
    }

    private fun handleTouch(event: MotionEvent): Boolean {
        if (event.actionMasked != MotionEvent.ACTION_DOWN) return true
        val w = glView.width.toFloat()
        val h = glView.height.toFloat()
        val x = event.x
        val y = event.y
        // Right 25% vertical strip = nitro; left/right halves elsewhere = lanes.
        return when {
            x > w * 0.75f -> renderer.tapNitro()
            y < h * 0.35f -> renderer.tapLane(0)
            else -> renderer.tapLane(if (x < w / 2f) -1 else 1)
        }
    }

    override fun onResume() {
        super.onResume()
        glView.onResume()
    }

    override fun onPause() {
        super.onPause()
        glView.onPause()
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) applyImmersive()
    }

    private fun applyImmersive() {
        val decor = window.decorView
        if (Build.VERSION.SDK_INT >= 30) {
            window.insetsController?.let { c ->
                c.hide(WindowInsets.Type.statusBars() or WindowInsets.Type.navigationBars())
                c.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            decor.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
        }
    }
}
