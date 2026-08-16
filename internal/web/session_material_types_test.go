package web

import (
	"net/http/httptest"
	"testing"

	"dndshare/internal/store"
)

func TestMaterialRequestNormalizesTypedPayloads(t *testing.T) {
	content := "  Текст письма  "
	style := "letter"
	req := sessionMaterialRequest{
		Scope: "session", Kind: "note", Name: "  Приказ  ", Content: &content, NoteStyle: &style,
	}
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("POST", "/", nil)
	if ok := (&Server{}).validateMaterialRequest(recorder, request, store.SceneSession{}, &req); !ok {
		t.Fatalf("valid note rejected: %s", recorder.Body.String())
	}
	if req.Name != "Приказ" || req.Content == nil || *req.Content != "Текст письма" || req.AssetID != nil {
		t.Fatalf("unexpected normalized note: %+v", req)
	}
}

func TestMaterialRequestRejectsMismatchedPayload(t *testing.T) {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest("POST", "/", nil)
	req := sessionMaterialRequest{Scope: "session", Kind: "video", Name: "Заставка"}
	if ok := (&Server{}).validateMaterialRequest(recorder, request, store.SceneSession{}, &req); ok {
		t.Fatal("video without an asset accepted")
	}

	content := "Тайна"
	badStyle := "newspaper"
	recorder = httptest.NewRecorder()
	req = sessionMaterialRequest{Scope: "session", Kind: "note", Name: "Записка", Content: &content, NoteStyle: &badStyle}
	if ok := (&Server{}).validateMaterialRequest(recorder, request, store.SceneSession{}, &req); ok {
		t.Fatal("note with unknown style accepted")
	}
}
