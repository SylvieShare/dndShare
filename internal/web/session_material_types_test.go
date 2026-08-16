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
		Kind: "note", Name: "  Приказ  ", Content: &content, NoteStyle: &style,
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
	req := sessionMaterialRequest{Kind: "video", Name: "Заставка"}
	if ok := (&Server{}).validateMaterialRequest(recorder, request, store.SceneSession{}, &req); ok {
		t.Fatal("video without an asset accepted")
	}

	content := "Тайна"
	badStyle := "newspaper"
	recorder = httptest.NewRecorder()
	req = sessionMaterialRequest{Kind: "note", Name: "Записка", Content: &content, NoteStyle: &badStyle}
	if ok := (&Server{}).validateMaterialRequest(recorder, request, store.SceneSession{}, &req); ok {
		t.Fatal("note with unknown style accepted")
	}
}

func TestMaterialAvailableForExplicitLinks(t *testing.T) {
	global := store.SessionMaterial{}
	if !materialAvailableFor(global, 10, 20) {
		t.Fatal("unlinked material must remain session-wide")
	}
	linked := store.SessionMaterial{
		ChapterLinks: []store.SessionMaterialChapterLink{{ChapterID: 10}},
		SceneLinks:   []store.SessionMaterialSceneLink{{SceneID: 30}},
	}
	if !materialAvailableFor(linked, 10, 20) || !materialAvailableFor(linked, 11, 30) {
		t.Fatal("material must be available through either matching relation")
	}
	if materialAvailableFor(linked, 11, 20) {
		t.Fatal("material leaked into an unrelated context")
	}
}
