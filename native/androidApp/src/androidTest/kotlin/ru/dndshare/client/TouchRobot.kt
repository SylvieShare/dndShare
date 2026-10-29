package ru.dndshare.client

import android.graphics.Rect
import android.os.Bundle
import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.test.platform.app.InstrumentationRegistry
import kotlin.test.*

internal object TouchRobot {
    private val instrumentation
        get() = InstrumentationRegistry.getInstrumentation()

    fun find(label: String): AccessibilityNodeInfo? = findNode {
        it.text?.toString() == label || it.contentDescription?.toString() == label
    }

    fun findNode(predicate: (AccessibilityNodeInfo) -> Boolean): AccessibilityNodeInfo? {
        fun visit(node: AccessibilityNodeInfo?): AccessibilityNodeInfo? {
            if (node == null) return null
            for (i in 0 until node.childCount) visit(node.getChild(i))?.let {
                return it
            }
            return node.takeIf(predicate)
        }
        return visit(instrumentation.uiAutomation.rootInActiveWindow)
    }

    fun await(label: String = "UI state", condition: () -> Boolean) {
        val end = SystemClock.uptimeMillis() + 12000
        while (!condition() && SystemClock.uptimeMillis() < end) Thread.sleep(30)
        if (!condition()) {
            fun dump(node: AccessibilityNodeInfo?, depth: Int = 0) {
                if (node == null || depth > 12) return
                android.util.Log.e(
                    "ControlsTest",
                    "UI ${node.className} text=${node.text} desc=${node.contentDescription} editable=${node.isEditable} actions=${node.actionList.map {it.id}}",
                )
                for (i in 0 until node.childCount) dump(node.getChild(i), depth + 1)
            }
            dump(instrumentation.uiAutomation.rootInActiveWindow)
        }
        assertTrue(condition(), "Timed out: $label")
    }

    fun click(label: String) {
        await(label) { find(label) != null }
        var node = requireNotNull(find(label))
        while (!node.isClickable && node.parent != null) node = node.parent
        assertTrue(node.performAction(AccessibilityNodeInfo.ACTION_CLICK), "Click: $label")
    }

    fun control(
        label: String,
        predicate: (AccessibilityNodeInfo) -> Boolean,
    ): AccessibilityNodeInfo? {
        val description = findNode { it.contentDescription?.toString() == label } ?: return null
        val area = Rect().also { description.getBoundsInScreen(it) }
        return findNode { candidate ->
            val bounds = Rect().also { candidate.getBoundsInScreen(it) }
            predicate(candidate) && area.contains(bounds.centerX(), bounds.centerY())
        }
    }

    fun setText(label: String, value: String) {
        fun editable() = control(label) { it.isEditable }
        await(label) { editable() != null }
        assertTrue(
            requireNotNull(editable())
                .performAction(
                    AccessibilityNodeInfo.ACTION_SET_TEXT,
                    Bundle().apply {
                        putCharSequence(
                            AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE,
                            value,
                        )
                    },
                ),
            "Editable native field: $label",
        )
    }

    fun bounds(label: String): Rect =
        Rect().also { requireNotNull(find(label)).getBoundsInScreen(it) }

    fun longPressDrag(x: Float, y: Float, toX: Float, toY: Float, duration: Int = 420) =
        performDrag(
            x,
            y,
            toX,
            toY,
            duration,
            null,
            android.view.ViewConfiguration.getLongPressTimeout() + 120,
        )

    fun drag(
        x: Float,
        y: Float,
        toX: Float,
        toY: Float,
        duration: Int = 420,
        beforeRelease: (() -> Unit)? = null,
    ) = performDrag(x, y, toX, toY, duration, beforeRelease, 0)

    private fun performDrag(
        x: Float,
        y: Float,
        toX: Float,
        toY: Float,
        duration: Int = 420,
        beforeRelease: (() -> Unit)?,
        hold: Int,
    ) {
        val down = SystemClock.uptimeMillis()
        fun event(action: Int, px: Float, py: Float) {
            val properties =
                MotionEvent.PointerProperties().apply {
                    id = 0
                    toolType = MotionEvent.TOOL_TYPE_FINGER
                }
            val coordinates =
                MotionEvent.PointerCoords().apply {
                    this.x = px
                    this.y = py
                    pressure = 1f
                    size = 1f
                }
            val e =
                MotionEvent.obtain(
                    down,
                    SystemClock.uptimeMillis(),
                    action,
                    1,
                    arrayOf(properties),
                    arrayOf(coordinates),
                    0,
                    0,
                    1f,
                    1f,
                    0,
                    0,
                    InputDevice.SOURCE_TOUCHSCREEN,
                    0,
                )
            try {
                assertTrue(instrumentation.uiAutomation.injectInputEvent(e, true))
            } finally {
                e.recycle()
            }
        }

        event(MotionEvent.ACTION_DOWN, x, y)
        if (hold > 0) SystemClock.sleep(hold.toLong())
        var lastX = x
        var lastY = y
        try {
            for (i in 1..20) {
                SystemClock.sleep((duration / 20).toLong())
                lastX = x + (toX - x) * i / 20
                lastY = y + (toY - y) * i / 20
                event(MotionEvent.ACTION_MOVE, lastX, lastY)
            }
            instrumentation.waitForIdleSync()
            beforeRelease?.invoke()
        } finally {
            event(MotionEvent.ACTION_UP, lastX, lastY)
        }
    }
}
