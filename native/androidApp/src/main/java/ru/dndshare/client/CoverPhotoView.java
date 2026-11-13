package ru.dndshare.client;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.widget.FrameLayout;
import android.widget.ImageView;

/** Two native layers cross-fade without a black frame; CENTER_CROP keeps the image centered. */
final class CoverPhotoView extends FrameLayout {
    private ImageView front, back;
    private Bitmap bitmap;
    private final java.util.function.BiConsumer<Integer, Integer> onSize;
    CoverPhotoView(Context context, java.util.function.BiConsumer<Integer, Integer> onSize) {
        super(context); this.onSize = onSize;
        setBackgroundColor(Color.BLACK); setKeepScreenOn(true);
        front = layer(context); back = layer(context);
        addView(front); addView(back);
        setContentDescription("Фотография персонажа");
    }
    private ImageView layer(Context context) {
        ImageView view = new ImageView(context);
        view.setLayoutParams(new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));
        view.setScaleType(ImageView.ScaleType.CENTER_CROP);
        return view;
    }
    void show(Bitmap next, boolean animate) {
        if (next == bitmap) return;
        front.animate().cancel(); back.animate().cancel();
        front.setAlpha(1f); back.setAlpha(0f);
        if (!animate || bitmap == null || !ValueAnimator.areAnimatorsEnabled()) {
            front.setImageBitmap(next); back.setImageDrawable(null); bitmap = next; return;
        }
        ImageView previous = front;
        front = back; back = previous;
        front.setImageBitmap(next); front.bringToFront();
        bitmap = next;
        front.animate().alpha(1).setDuration(450).withEndAction(() -> previous.setImageDrawable(null)).start();
    }
    void clear() {
        front.animate().cancel(); back.animate().cancel();
        front.setImageDrawable(null); back.setImageDrawable(null); bitmap = null;
    }
    @Override protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        super.onSizeChanged(width, height, oldWidth, oldHeight);
        if (width > 0 && height > 0) onSize.accept(width, height);
    }
}
