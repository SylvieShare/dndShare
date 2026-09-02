package web

import (
	"encoding/json"
	"testing"

	"dndshare/internal/store"
)

func TestScenarioJournalMutationConvertsDialogueAndKeepsSnapshot(t *testing.T) {
	raw := json.RawMessage(`{"rows":[{"left":"Смотритель","right":"Ворота закрыты"}]}`)
	item := store.SessionSceneItem{ID: 42, SceneID: 7, Type: "list", Title: "У ворот", Data: &raw}
	mutation := scenarioJournalMutation(item, store.SessionScene{ID: 7, Name: "Северные ворота"})

	if mutation.Type != "dialog" || mutation.Title != "У ворот" {
		t.Fatalf("unexpected mutation: %#v", mutation)
	}
	var payload map[string][]map[string]any
	if err := json.Unmarshal(mutation.Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if got := payload["dialogue"][0]["speaker"]; got != "Смотритель" {
		t.Fatalf("unexpected speaker: %v", got)
	}
	var snapshot map[string]any
	if err := json.Unmarshal(mutation.SourceSnapshot, &snapshot); err != nil {
		t.Fatal(err)
	}
	scene := snapshot["scene"].(map[string]any)
	if scene["name"] != "Северные ворота" {
		t.Fatalf("unexpected scene snapshot: %#v", scene)
	}
}

func TestScenarioJournalMutationConvertsCombatants(t *testing.T) {
	raw := json.RawMessage(`{"creatures":[{"kind":"handbook","itemId":15,"count":2},{"kind":"simple","name":"Главарь","count":1,"ac":14,"hp":22}]}`)
	item := store.SessionSceneItem{ID: 9, Type: "combat", Title: "Засада", Data: &raw}
	mutation := scenarioJournalMutation(item, store.SessionScene{ID: 3, Name: "Тракт"})

	if mutation.Type != "battle" {
		t.Fatalf("expected battle, got %q", mutation.Type)
	}
	var payload struct {
		Combatants []map[string]any `json:"combatants"`
	}
	if err := json.Unmarshal(mutation.Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if len(payload.Combatants) != 2 || payload.Combatants[0]["source"] != "handbook" || payload.Combatants[1]["name"] != "Главарь" {
		t.Fatalf("unexpected combatants: %#v", payload.Combatants)
	}
}
