package store

import "testing"

func TestItemModelPresenceOmitsPrivateAndHiddenWithoutAQuery(t *testing.T) {
	owner := int64(1)
	s := &Store{}
	items, err := s.attachItemModels(t.Context(), []Item{{ID: 1, UserID: &owner, ModelID: "stale"}, {ID: 2, Hidden: true, ModelID: "stale"}})
	if err != nil || items[0].ModelID != "" || items[1].ModelID != "" {
		t.Fatalf("private or hidden model presence leaked: %+v %v", items, err)
	}
	if _, err := s.attachItemModels(t.Context(), nil); err != nil {
		t.Fatal(err)
	}
}
