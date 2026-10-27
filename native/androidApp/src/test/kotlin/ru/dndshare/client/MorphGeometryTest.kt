package ru.dndshare.client

import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import org.junit.Test
import ru.dndshare.client.ui.designsystem.*
import kotlin.test.*

class MorphGeometryTest {
    @Test fun resizingAndInvalidAnchorsAlwaysProduceAnOnscreenUsableTarget() {
        val anchors = listOf(null, Rect.Zero, Rect(Float.NaN, 0f, 200f, 100f),
            Rect(-10000f, -10000f, -5000f, -5000f), Rect(-10000f, -10000f, 1e8f, 1e8f))
        for (size in listOf(Size(390f, 800f), Size(834f, 300f), Size(1920f, 1000f), Size.Zero)) {
            for (anchor in anchors) {
                val plan = morphPlan(size, anchor, Rect(20f, 20f, 280f, 120f), 1f)
                val target = plan.frame(1f, 450f)
                assertTrue(listOf(target.left, target.top, target.right, target.bottom).all(Float::isFinite))
                assertTrue(target.width > 0 && target.height > 0)
                assertTrue(target.left >= 0 && target.top >= 0)
                assertTrue(target.right <= plan.viewport.width + .001f && target.bottom <= plan.viewport.height + .001f)
                assertTrue(plan.editorWidth > 0 && plan.previewLimit > 0)
            }
        }
    }

    @Test fun openingPassesThroughIntermediateWidthsAndClosingUsesTheSameGeometry() {
        val plan = morphPlan(Size(390f, 800f), Rect(20f, 80f, 370f, 260f), null, 1f)
        assertEquals(plan.source, plan.frame(0f, 280f))
        val halfway = plan.frame(.5f, 280f)
        assertTrue(halfway.width > plan.source.width)
        assertTrue(halfway.width < plan.frame(1f, 280f).width)
        assertEquals(360f, plan.previewLimit)
        assertTrue(plan.maximumHeight - plan.previewLimit >= 280f)
    }

    @Test fun anOffscreenLiveAnchorFallsBackToTheLastVisibleLocation() {
        val last = Rect(20f, 80f, 370f, 260f)
        assertEquals(last, morphPlan(Size(390f, 800f), Rect(0f, -500f, 200f, -200f), last, 1f).source)
    }
}
