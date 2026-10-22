package web

import (
	"bytes"
	"context"
	"dndshare/internal/battlemap"
	"encoding/json"
	"mime/multipart"
	"net/http/httptest"
	"testing"
)

func TestMapDecalUploadsRequireLoginAndValidateRaster(t *testing.T) {
	s := &Server{}
	for _, handler := range []func(*httptest.ResponseRecorder){
		func(w *httptest.ResponseRecorder) {
			s.handleMapDecals(w, httptest.NewRequest("GET", "/api/maps/decals", nil))
		},
		func(w *httptest.ResponseRecorder) {
			s.handleUploadMapDecal(w, httptest.NewRequest("POST", "/api/maps/decals", nil))
		},
	} {
		w := httptest.NewRecorder()
		handler(w)
		if w.Code != 401 {
			t.Fatalf("unauthorized: %d", w.Code)
		}
	}
	for _, data := range [][]byte{[]byte("<svg xmlns='http://www.w3.org/2000/svg'/>"), pngIconHeader(2049, 100), webpExtendedIconHeader(100, 2049)} {
		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		part, _ := writer.CreateFormFile("file", "stamp.png")
		part.Write(data)
		writer.WriteField("name", "Декаль")
		writer.WriteField("category", "traces")
		writer.Close()
		r := httptest.NewRequest("POST", "/api/maps/decals", &body)
		r.Header.Set("Content-Type", writer.FormDataContentType())
		r = r.WithContext(context.WithValue(r.Context(), userIDKey, int64(1)))
		w := httptest.NewRecorder()
		s.handleUploadMapDecal(w, r)
		if w.Code != 400 {
			t.Fatalf("invalid raster accepted: %d %s", w.Code, w.Body.String())
		}
	}
}

func TestDecalPreviewTracksPixelsButIgnoresLabels(t *testing.T) {
	d := battlemap.Document{Decals: []battlemap.Decal{{ID: "stamp", Name: "Кровь", Category: "traces", ImageURL: "/images/maps/decals/blood-pool.svg", Opacity: 1, Width: 1}}}
	before, _ := json.Marshal(mapPreviewScene(d))
	d.Decals[0].Name = "Новая подпись"
	d.Decals[0].Category = "custom"
	after, _ := json.Marshal(mapPreviewScene(d))
	if string(before) != string(after) {
		t.Fatal("labels invalidated preview")
	}
	if d.Decals[0].Name != "Новая подпись" {
		t.Fatal("signature projection mutated the document")
	}
	d.Decals[0].Opacity = .5
	after, _ = json.Marshal(mapPreviewScene(d))
	if string(before) == string(after) {
		t.Fatal("visual change retained stale preview")
	}
}
