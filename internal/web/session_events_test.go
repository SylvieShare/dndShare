package web

import (
	"encoding/json"
	"testing"
)

func TestNormalizeCharacterSessionEntryAdded(t *testing.T) {
	event, ok := normalizeCharacterSessionEvent(characterSessionEventRequest{
		SessionUUID:    "11111111-1111-4111-8111-111111111111",
		Type:           "entry_added",
		Title:          "Огненный шар",
		Data:           json.RawMessage(`{"kind":"spell","level":3}`),
		ClientActionID: "22222222-2222-4222-8222-222222222222",
	})

	if !ok {
		t.Fatal("entry_added must be accepted as a character session event")
	}
	if event.EventType != "entry_added" || event.Visibility != "public" {
		t.Fatalf("unexpected normalized event: %#v", event)
	}
}
