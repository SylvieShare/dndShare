package store

import (
	"encoding/json"
	"os"
	"strings"
	"testing"
)

func TestValidateAdventureDocumentRequiresNamedArc(t *testing.T) {
	if err := validateAdventureDocument(SessionAdventureDocument{}); err == nil {
		t.Fatal("empty adventure must be rejected")
	}
	doc := SessionAdventureDocument{Name: "Test", Arcs: []SessionAdventureArc{{Key: "main", Name: "Main"}}}
	if err := validateAdventureDocument(doc); err != nil {
		t.Fatalf("minimal adventure rejected: %v", err)
	}
}

func TestAdventurePutKeyRejectsDuplicates(t *testing.T) {
	keys := map[string]int64{}
	if err := adventurePutKey(keys, "chapter-1", "chapter", 1); err != nil {
		t.Fatalf("first key rejected: %v", err)
	}
	if err := adventurePutKey(keys, "chapter-1", "chapter", 2); err == nil {
		t.Fatal("duplicate key must be rejected")
	}
}

func TestAshCrownDemoMatchesPortableDocument(t *testing.T) {
	payload, err := os.ReadFile("../../resources/demo-adventures/ash-crown.json")
	if err != nil {
		t.Fatal(err)
	}
	var doc SessionAdventureDocument
	decoder := json.NewDecoder(strings.NewReader(string(payload)))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&doc); err != nil {
		t.Fatalf("decode demo adventure: %v", err)
	}
	if err := validateAdventureDocument(doc); err != nil {
		t.Fatalf("validate demo adventure: %v", err)
	}
	if len(doc.Arcs) != 2 || len(doc.Arcs[0].Chapters)+len(doc.Arcs[1].Chapters) != 6 {
		t.Fatalf("unexpected demo structure: %d arcs", len(doc.Arcs))
	}
}
