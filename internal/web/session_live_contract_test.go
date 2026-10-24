package web

import (
	"dndshare/internal/documentpatch"
	"dndshare/internal/store"
	"encoding/json"
	"os"
	"reflect"
	"testing"
	"time"
)

func TestSessionLiveWireContract(t *testing.T) {
	raw, err := os.ReadFile("testdata/session-live.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixtures map[string]any
	if err := json.Unmarshal(raw, &fixtures); err != nil {
		t.Fatal(err)
	}
	event := store.SessionEvent{ID: 1, SessionOwnerUserID: 1, AuthorName: "Player", AuthorUserID: 2, EventType: "hp_changed", Action: "HP: 10", Data: json.RawMessage(`{"current":10}`), Visibility: "public", CreatedAt: time.Date(2026, 10, 24, 12, 0, 0, 0, time.UTC)}
	initial := sessionLiveUpdate{Roster: &sessionRosterUpdate{Sequence: 1, Data: json.RawMessage(`[{"charId":7,"data":{"values":{"hp":{"current":10}}}}]`), Patches: []documentpatch.Operation{}}, Chronicle: &sessionEventsResponse{Baseline: []store.SessionEvent{event}, Events: []store.SessionEvent{}, Updates: []store.SessionEvent{}}}
	event.ID, event.Action, event.Data, event.CreatedAt = 2, "HP: 9", json.RawMessage(`{"current":9}`), event.CreatedAt.Add(time.Minute)
	delta := sessionLiveUpdate{Chronicle: &sessionEventsResponse{Events: []store.SessionEvent{event}, Updates: []store.SessionEvent{}}}
	for name, value := range map[string]sessionLiveUpdate{"initial": initial, "delta": delta} {
		encoded, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		var actual any
		if err := json.Unmarshal(encoded, &actual); err != nil {
			t.Fatal(err)
		}
		if !reflect.DeepEqual(actual, fixtures[name]) {
			t.Fatalf("%s SSE contract changed: %s", name, encoded)
		}
	}
}
