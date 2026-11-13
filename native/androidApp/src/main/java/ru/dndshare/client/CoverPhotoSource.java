package ru.dndshare.client;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Immutable identity; measured dimensions are filled by the background image loader. */
final class CoverPhotoSource {
    final String uid, url, thumbnailUrl;
    final long imageId;
    volatile int width, height;
    CoverPhotoSource(String uid, String url, String thumbnailUrl, long imageId, int width, int height) {
        this.uid = uid; this.url = url; this.thumbnailUrl = thumbnailUrl; this.imageId = imageId;
        this.width = width; this.height = height;
    }
    static List<CoverPhotoSource> read(JSONArray values) {
        List<CoverPhotoSource> photos = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        if (values == null) return photos;
        for (int i = 0; i < values.length(); i++) {
            JSONObject value = values.optJSONObject(i);
            if (value == null) continue;
            String uid = value.optString("uid"), url = value.optString("url");
            if (uid.isEmpty() || url.isEmpty() || !seen.add(uid)) continue;
            photos.add(new CoverPhotoSource(uid, url, value.optString("thumbnailUrl"), value.optLong("imageId"), value.optInt("width"), value.optInt("height")));
        }
        return photos;
    }
    static CoverPhotoSource choose(List<CoverPhotoSource> photos, String current, int width, int height, boolean advance, Set<String> failed) {
        List<CoverPhotoSource> matching = new ArrayList<>(), squares = new ArrayList<>(), all = new ArrayList<>();
        boolean landscape = width > height;
        for (CoverPhotoSource photo : photos) {
            if (photo.width <= 0 || photo.height <= 0 || failed.contains(photo.uid)) continue;
            all.add(photo);
            if (photo.width == photo.height) squares.add(photo);
            else if ((photo.width > photo.height) == landscape) matching.add(photo);
        }
        List<CoverPhotoSource> pool = !matching.isEmpty() ? matching : !squares.isEmpty() ? squares : all;
        if (pool.isEmpty()) return null;
        double ratio = width > 0 && height > 0 ? (double) width / height : .5;
        CoverPhotoSource best = pool.stream().min(java.util.Comparator.comparingDouble(photo -> Math.abs(Math.log(((double) photo.width / photo.height) / ratio)))).orElse(null);
        if (matching.isEmpty() && squares.isEmpty()) return best;
        for (int i = 0; i < pool.size(); i++) if (pool.get(i).uid.equals(current)) return advance ? pool.get((i + 1) % pool.size()) : pool.get(i);
        return best;
    }
}
