package web

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"dndshare/internal/store"
)

func TestValidateTutorial(t *testing.T) {
	valid := store.UserTutorial{FlowID: "character", SourceKey: "edition:12", Device: "mobile", Revision: 1, Status: "completed"}
	if !validateTutorial(valid, false) {
		t.Fatal("valid tutorial rejected")
	}
	for _, mutate := range []func(*store.UserTutorial){
		func(e *store.UserTutorial) { e.FlowID = "unknown" },
		func(e *store.UserTutorial) { e.SourceKey = "edition:-1" },
		func(e *store.UserTutorial) { e.SourceKey = "source:1" },
		func(e *store.UserTutorial) { e.Device = "tablet" },
		func(e *store.UserTutorial) { e.Revision = 0 },
		func(e *store.UserTutorial) { e.Status = "started" },
	} {
		entry := valid
		mutate(&entry)
		if validateTutorial(entry, false) {
			t.Errorf("invalid tutorial accepted: %+v", entry)
		}
	}
	valid.Status = ""
	valid.Revision = 0
	if !validateTutorial(valid, true) {
		t.Fatal("reset must accept identity without progress")
	}
}
func TestAccountTutorialsRequireAuthentication(t *testing.T) {
	server := &Server{}
	for _, handler := range []http.HandlerFunc{server.handleListAccountTutorials, server.handleSaveAccountTutorial, server.handleResetAccountTutorial} {
		recorder := httptest.NewRecorder()
		handler(recorder, httptest.NewRequest(http.MethodGet, "/api/account/tutorials", nil))
		if recorder.Code != http.StatusUnauthorized {
			t.Fatalf("got %d", recorder.Code)
		}
	}
}
