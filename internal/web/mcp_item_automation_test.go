package web

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMCPItemAutomation(t *testing.T) {
	var args map[string]json.RawMessage
	json.Unmarshal([]byte(`{"name":"Название","automationStatus":"full","requiresPlayerInteraction":true}`), &args)
	patch, err := mcpItemAutomation(args)
	if err != nil || patch.Initial().AutomationStatus != "full" || !patch.Initial().RequiresPlayerInteraction {
		t.Fatalf("patch=%+v err=%v", patch, err)
	}
	args["automationStatus"] = json.RawMessage(`"invalid"`)
	if _, err := mcpItemAutomation(args); err == nil {
		t.Fatal("accepted invalid status")
	}
}

func TestCreateItemRejectsInvalidAutomationBeforeWriting(t *testing.T) {
	for _, body := range []string{`{"typeId":19,"name":"Тест","data":{},"automationStatus":"invalid"}`, `{"typeId":19,"automationNote":"` + strings.Repeat("я", 1001) + `"}`} {
		r := httptest.NewRequest("POST", "/api/items", strings.NewReader(body))
		r = r.WithContext(context.WithValue(r.Context(), userIDKey, int64(42)))
		w := httptest.NewRecorder()
		(&Server{}).handleCreateItem(w, r)
		if w.Code != 400 {
			t.Fatalf("status=%d body=%s", w.Code, w.Body.String())
		}
	}
}
