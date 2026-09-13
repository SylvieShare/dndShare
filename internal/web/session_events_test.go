package web

import (
	"encoding/json"
	"testing"
)

func TestNormalizeCharacterSessionEntryAdded(t *testing.T) {
	event, ok := normalizeCharacterSessionEvent(characterSessionEventRequest{
		SessionUUID:    "11111111-1111-4111-8111-111111111111",
		Type:           "entry_added",
		Action:         "Использовано: Огненный шар",
		Data:           json.RawMessage(`{"kind":"spell","level":3}`),
		ClientActionID: "22222222-2222-4222-8222-222222222222",
	})

	if !ok {
		t.Fatal("entry_added must be accepted as a character session event")
	}
	if event.EventType != "entry_added" || event.Visibility != "public" {
		t.Fatalf("unexpected normalized event: %#v", event)
	}
	if event.Action != "Использовано: Огненный шар" {
		t.Fatalf("unexpected action: %q", event.Action)
	}
}

func TestNormalizeCharacterSessionStateEvents(t *testing.T) {
	for _, eventType := range []string{"feature_state", "status_effect"} {
		event, ok := normalizeCharacterSessionEvent(characterSessionEventRequest{
			SessionUUID:    "11111111-1111-4111-8111-111111111111",
			Type:           eventType,
			Action:         "Ярость: выключено",
			ClientActionID: "22222222-2222-4222-8222-222222222222",
		})
		if !ok {
			t.Fatalf("%s must be accepted as a character session event", eventType)
		}
		if event.EventType != eventType {
			t.Fatalf("unexpected normalized event: %#v", event)
		}
	}
}

func TestCharacterResourceEventTypes(t *testing.T) {
	for _, eventType := range []string{"spell_slot_changed", "feature_action_effect"} {
		event, ok := normalizeCharacterSessionEvent(characterSessionEventRequest{
			SessionUUID: "00000000-0000-4000-8000-000000000001", Type: eventType,
			Action: "Восстановление ячеек", ClientActionID: "00000000-0000-4000-8000-000000000002",
			Data: json.RawMessage(`{"resourceChanges":[{"delta":2,"level":3,"pool":"short_rest"}]}`),
		})
		if !ok || event.EventType != eventType {
			t.Fatalf("character event %s must be accepted by the atomic save: %#v, %v", eventType, event, ok)
		}
	}
}
