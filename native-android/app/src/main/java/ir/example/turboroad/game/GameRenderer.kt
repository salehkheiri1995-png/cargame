package ir.example.turboroad.game

import android.opengl.GLES30
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import kotlin.math.max
import kotlin.math.min
import kotlin.math.tan
import kotlin.math.sqrt

/* ------------------------------------------------------------------ */
/* Minimal 4x4 matrix helpers (column-major, GL-style).                */
/* ------------------------------------------------------------------ */
private object Mat4 {
    fun identity(): FloatArray = floatArrayOf(
        1f, 0f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 0f, 1f, 0f, 0f, 0f, 0f, 1f
    )

    fun perspective(fovyRad: Float, aspect: Float, znear: Float, zfar: Float): FloatArray {
        val f = 1f / tan(fovyRad / 2f)
        val o = FloatArray(16)
        o[0] = f / aspect
        o[5] = f
        o[10] = (zfar + znear) / (znear - zfar)
        o[11] = -1f
        o[14] = (2f * zfar * znear) / (znear - zfar)
        return o
    }

    fun lookAt(eye: FloatArray, center: FloatArray, up: FloatArray): FloatArray {
        var fx = center[0] - eye[0]; var fy = center[1] - eye[1]; var fz = center[2] - eye[2]
        val fl = sqrt(fx * fx + fy * fy + fz * fz); fx /= fl; fy /= fl; fz /= fl

        var sx = fy * up[2] - fz * up[1]
        var sy = fz * up[0] - fx * up[2]
        var sz = fx * up[1] - fy * up[0]
        val sl = sqrt(sx * sx + sy * sy + sz * sz); sx /= sl; sy /= sl; sz /= sl

        val ux = sy * fz - sz * fy
        val uy = sz * fx - sx * fz
        val uz = sx * fy - sy * fx

        val o = FloatArray(16)
        o[0] = sx; o[4] = sy; o[8] = sz
        o[1] = ux; o[5] = uy; o[9] = uz
        o[2] = -fx; o[6] = -fy; o[10] = -fz
        o[12] = -(sx * eye[0] + sy * eye[1] + sz * eye[2])
        o[13] = -(ux * eye[0] + uy * eye[1] + uz * eye[2])
        o[14] = fx * eye[0] + fy * eye[1] + fz * eye[2]
        o[15] = 1f
        return o
    }

    fun multiply(a: FloatArray, b: FloatArray): FloatArray {
        val o = FloatArray(16)
        for (c in 0..3) for (r in 0..3) {
            o[c * 4 + r] = a[0 * 4 + r] * b[c * 4 + 0] +
                a[1 * 4 + r] * b[c * 4 + 1] +
                a[2 * 4 + r] * b[c * 4 + 2] +
                a[3 * 4 + r] * b[c * 4 + 3]
        }
        return o
    }

    fun translate(tx: Float, ty: Float, tz: Float): FloatArray {
        val o = identity(); o[12] = tx; o[13] = ty; o[14] = tz; return o
    }

    fun scale(sx: Float, sy: Float, sz: Float): FloatArray {
        val o = FloatArray(16)
        o[0] = sx; o[5] = sy; o[10] = sz; o[15] = 1f
        return o
    }
}

/* ------------------------------------------------------------------ */
/* Geometry builders.                                                  */
/* ------------------------------------------------------------------ */
private object Geometry {

    /** 36 vertices (non-indexed) for a unit box centred at origin. */
    fun unitBox(): FloatArray {
        val f = 0.5f
        val p000 = floatArrayOf(-f, -f, -f); val p100 = floatArrayOf(f, -f, -f)
        val p010 = floatArrayOf(-f, f, -f);  val p110 = floatArrayOf(f, f, -f)
        val p001 = floatArrayOf(-f, -f, f);  val p101 = floatArrayOf(f, -f, f)
        val p011 = floatArrayOf(-f, f, f);   val p111 = floatArrayOf(f, f, f)
        val v = ArrayList<Float>(108)
        fun quad(a: FloatArray, b: FloatArray, c: FloatArray, d: FloatArray) {
            v.addAll(a.toList()); v.addAll(b.toList()); v.addAll(c.toList())
            v.addAll(a.toList()); v.addAll(c.toList()); v.addAll(d.toList())
        }
        quad(p001, p101, p111, p011) // +z
        quad(p000, p010, p110, p100) // -z
        quad(p100, p110, p111, p101) // +x
        quad(p000, p001, p011, p010) // -x
        quad(p010, p011, p111, p110) // +y
        quad(p000, p100, p101, p001) // -y
        return v.toFloatArray()
    }

    /** Road surface rectangle (x in [-hw,hw], z in [z0,z1]). */
    fun roadSurface(hw: Float, z0: Float, z1: Float): FloatArray {
        return floatArrayOf(
            -hw, 0f, z0, hw, 0f, z0, hw, 0f, z1,
            -hw, 0f, z0, hw, 0f, z1, -hw, 0f, z1
        )
    }

    /** A long solid strip (for edge lines). */
    fun edgeStrip(x: Float, z0: Float, z1: Float, halfWidth: Float): FloatArray {
        return floatArrayOf(
            x - halfWidth, 0.005f, z0, x + halfWidth, 0.005f, z0, x + halfWidth, 0.005f, z1,
            x - halfWidth, 0.005f, z0, x + halfWidth, 0.005f, z1, x - halfWidth, 0.005f, z1
        )
    }

    /** Dashed centre/dividing line: small quads at fixed Z pitch. */
    fun dashedLine(x: Float, z0: Float, z1: Float, seg: Float, gap: Float): FloatArray {
        val v = ArrayList<Float>()
        var z = z0
        val hw = 0.09f
        while (z > z1) {
            val zEnd = max(z - seg, z1)
            v.add(x - hw); v.add(0.006f); v.add(z)
            v.add(x + hw); v.add(0.006f); v.add(z)
            v.add(x + hw); v.add(0.006f); v.add(zEnd)
            v.add(x - hw); v.add(0.006f); v.add(z)
            v.add(x + hw); v.add(0.006f); v.add(zEnd)
            v.add(x - hw); v.add(0.006f); v.add(zEnd)
            z -= (seg + gap)
        }
        return v.toFloatArray()
    }
}

/* ------------------------------------------------------------------ */
/* GPU-side static mesh.                                               */
/* ------------------------------------------------------------------ */
private class GpuMesh(positions: FloatArray) {
    val vbo: Int
    val count: Int

    init {
        count = positions.size / 3
        val buffer: FloatBuffer = ByteBuffer
            .allocateDirect(positions.size * 4)
            .order(ByteOrder.nativeOrder())
            .asFloatBuffer()
        buffer.put(positions).position(0)

        val tmp = IntArray(1)
        GLES30.glGenBuffers(1, tmp, 0)
        vbo = tmp[0]
        GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, vbo)
        GLES30.glBufferData(GLES30.GL_ARRAY_BUFFER, positions.size * 4, buffer, GLES30.GL_STATIC_DRAW)
        GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, 0)
    }

    fun draw() {
        GLES30.glBindBuffer(GLES30.GL_ARRAY_BUFFER, vbo)
        GLES30.glEnableVertexAttribArray(0)
        GLES30.glVertexAttribPointer(0, 3, GLES30.GL_FLOAT, false, 0, 0)
        GLES30.glDrawArrays(GLES30.GL_TRIANGLES, 0, count)
    }
}

/* ------------------------------------------------------------------ */
/* Game state + renderer.                                              */
/* ------------------------------------------------------------------ */
class GameRenderer : android.opengl.GLSurfaceView.Renderer {

    // --- GL handles ---
    private var program = 0
    private var uMvp = 0
    private var uColor = 0
    private var boxMesh: GpuMesh? = null
    private var roadSurface: GpuMesh? = null
    private var roadEdge: GpuMesh? = null
    private var roadDash: GpuMesh? = null

    // --- camera / matrices ---
    private var aspect = 1.7f
    private val eye = floatArrayOf(0f, 3.5f, 6.2f)
    private val center = floatArrayOf(0f, 0.3f, -12f)
    private val up = floatArrayOf(0f, 1f, 0f)
    private val proj = FloatArray(16)
    private val view = FloatArray(16)
    private val model = FloatArray(16)
    private val mvp = FloatArray(16)

    // --- gameplay ---
    private val laneX = floatArrayOf(-2.4f, 0f, 2.4f)
    private var targetLane = 1
    private var playerX = 0f
    private var speedKmh = 60f
    private var distanceM = 0f
    private var score = 0
    private var state = "running" // running | over
    private var lastNs = 0L

    private class Traffic(var x: Float, var z: Float, var color: FloatArray)
    private val traffic = ArrayList<Traffic>()
    private var spawnTimer = 0f

    private val trafficColors = arrayOf(
        floatArrayOf(0.9f, 0.91f, 0.95f),
        floatArrayOf(0.2f, 0.28f, 0.4f),
        floatArrayOf(0.95f, 0.8f, 0.25f),
        floatArrayOf(0.75f, 0.2f, 0.2f),
        floatArrayOf(0.2f, 0.6f, 0.75f),
    )

    var hudUpdater: ((String) -> Unit)? = null

    private fun compile(type: Int, source: String): Int {
        val s = GLES30.glCreateShader(type)
        GLES30.glShaderSource(s, source)
        GLES30.glCompileShader(s)
        val ok = IntArray(1)
        GLES30.glGetShaderiv(s, GLES30.GL_COMPILE_STATUS, ok, 0)
        if (ok[0] == 0) {
            val log = GLES30.glGetShaderInfoLog(s)
            throw RuntimeException("Shader compile failed: $log")
        }
        return s
    }

    override fun onSurfaceCreated(gl: javax.microedition.khronos.opengles.GL10?, config: javax.microedition.khronos.egl.EGLConfig?) {
        GLES30.glClearColor(0.03f, 0.05f, 0.09f, 1f)
        GLES30.glEnable(GLES30.GL_DEPTH_TEST)

        val vs = """
            uniform mat4 uMVPMatrix;
            attribute vec3 aPosition;
            void main() {
                gl_Position = uMVPMatrix * vec4(aPosition, 1.0);
            }
        """.trimIndent()
        val fs = """
            precision mediump float;
            uniform vec4 uColor;
            void main() { gl_FragColor = uColor; }
        """.trimIndent()

        val v = compile(GLES30.GL_VERTEX_SHADER, vs)
        val f = compile(GLES30.GL_FRAGMENT_SHADER, fs)
        program = GLES30.glCreateProgram()
        GLES30.glAttachShader(program, v)
        GLES30.glAttachShader(program, f)
        GLES30.glLinkProgram(program)
        val ok = IntArray(1)
        GLES30.glGetProgramiv(program, GLES30.GL_LINK_STATUS, ok, 0)
        if (ok[0] == 0) throw RuntimeException("Link failed: ${GLES30.glGetProgramInfoLog(program)}")
        GLES30.glDeleteShader(v)
        GLES30.glDeleteShader(f)

        GLES30.glBindAttribLocation(program, 0, "aPosition")
        uMvp = GLES30.glGetUniformLocation(program, "uMVPMatrix")
        uColor = GLES30.glGetUniformLocation(program, "uColor")

        boxMesh = GpuMesh(Geometry.unitBox())
        roadSurface = GpuMesh(Geometry.roadSurface(4.0f, 0f, -160f))
        roadEdge = GpuMesh(
            Geometry.edgeStrip(-3.82f, 0f, -160f, 0.12f)
                .plus(Geometry.edgeStrip(3.82f, 0f, -160f, 0.12f))
        )
        roadDash = GpuMesh(
            Geometry.dashedLine(0f, 0f, -160f, 4f, 7f)
                .plus(Geometry.dashedLine(-1.6f, 0f, -160f, 4f, 7f))
                .plus(Geometry.dashedLine(1.6f, 0f, -160f, 4f, 7f))
        )

        lastNs = System.nanoTime()
    }

    override fun onSurfaceChanged(gl: javax.microedition.khronos.opengles.GL10?, width: Int, height: Int) {
        GLES30.glViewport(0, 0, width, height)
        aspect = if (height == 0) 1.6f else width.toFloat() / height.toFloat()
        val p = Mat4.perspective(1.05f, aspect, 0.1f, 220f)
        p.copyInto(proj)
        val v = Mat4.lookAt(eye, center, up)
        v.copyInto(view)
    }

    override fun onDrawFrame(gl: javax.microedition.khronos.opengles.GL10?) {
        val now = System.nanoTime()
        val dt = min(0.05f, max(0.0001f, (now - lastNs) / 1e9f))
        lastNs = now

        if (state == "running") update(dt)

        GLES30.glClear(GLES30.GL_COLOR_BUFFER_BIT or GLES30.GL_DEPTH_BUFFER_BIT)
        GLES30.glUseProgram(program)

        // Road (world space, model = identity)
        drawMesh(roadSurface, Mat4.identity(), floatArrayOf(0.13f, 0.15f, 0.2f, 1f))
        drawMesh(roadEdge, Mat4.identity(), floatArrayOf(0.85f, 0.88f, 0.95f, 1f))
        drawMesh(roadDash, Mat4.identity(), floatArrayOf(0.9f, 0.75f, 0.2f, 1f))

        // Player car (body + cabin)
        drawCar(playerX, 0f, 0f, floatArrayOf(0.16f, 0.55f, 0.92f, 1f))

        // Traffic
        for (t in traffic) drawCar(t.x, 0f, t.z, t.color)

        pushHud()
    }

    private fun drawCar(x: Float, y: Float, z: Float, color: FloatArray) {
        // body
        val m1 = Mat4.multiply(Mat4.translate(x, y + 0.45f, z), Mat4.scale(1.9f, 0.85f, 3.4f))
        drawMesh(boxMesh, m1, color)
        // cabin (smaller, raised)
        val m2 = Mat4.multiply(Mat4.translate(x, y + 0.95f, z + 0.3f), Mat4.scale(1.5f, 0.6f, 1.8f))
        drawMesh(boxMesh, m2, floatArrayOf(color[0] * 1.15f, color[1] * 1.15f, color[2] * 1.15f, 1f))
    }

    private fun drawMesh(mesh: GpuMesh?, m: FloatArray, color: FloatArray) {
        if (mesh == null) return
        val mv = Mat4.multiply(view, m)
        val mvp = Mat4.multiply(proj, mv)
        GLES30.glUniformMatrix4fv(uMvp, 1, false, mvp, 0)
        GLES30.glUniform4fv(uColor, 1, color, 0)
        mesh.draw()
    }

    /* ------------------------- gameplay ------------------------- */

    private fun update(dt: Float) {
        speedKmh = min(220f, speedKmh + 0.35f)
        distanceM += speedKmh / 3.6f * dt
        score = (distanceM * 0.5f).toInt()

        // eased lane change
        val target = laneX[targetLane]
        playerX += (target - playerX) * min(1f, dt * 8f)
        if (kotlin.math.abs(playerX - target) < 0.02f) playerX = target

        spawnTimer -= dt
        if (spawnTimer <= 0f) {
            spawnTimer = 1.4f - min(0.8f, speedKmh / 220f * 0.7f)
            if (traffic.size < 5) {
                val lane = (0..2).random()
                val color = trafficColors[(0 until trafficColors.size).random()]
                traffic.add(Traffic(laneX[lane], -150f, color))
            }
        }

        // move traffic toward player
        val rel = speedKmh / 3.6f
        val it = traffic.iterator()
        while (it.hasNext()) {
            val t = it.next()
            t.z += rel * 0.72f * dt
            if (t.z > 2.5f) { it.remove(); continue }

            // collision (rough AABB)
            val dz = kotlin.math.abs(t.z) - 1.7f
            val dx = kotlin.math.abs(t.x - playerX)
            if (dz < 1.6f && dx < 1.4f) {
                state = "over"
                break
            }
        }
    }

    fun tapLane(dir: Int): Boolean {
        if (state == "over") { reset(); return true }
        val next = targetLane + dir
        if (next in 0..2) targetLane = next
        return true
    }

    fun tapNitro(): Boolean {
        if (state == "over") { reset(); return true }
        speedKmh = min(260f, speedKmh + 30f)
        return true
    }

    private fun reset() {
        targetLane = 1
        playerX = 0f
        speedKmh = 60f
        distanceM = 0f
        score = 0
        traffic.clear()
        spawnTimer = 0.4f
        state = "running"
    }

    private fun pushHud() {
        val msg = if (state == "over") {
            "GAME OVER\nScore: $score\nTap anywhere to restart"
        } else {
            "${speedKmh.toInt()} km/h\n${distanceM.toInt()} m\nScore: $score"
        }
        hudUpdater?.invoke(msg)
    }
}
