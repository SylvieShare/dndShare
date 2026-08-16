package web

import (
	"net/http/httptest"
	"strings"
	"testing"

	"dndshare/internal/store"
)

func TestLocationMutationValidatesKindAndPreset(t *testing.T) {
	valid := locationMutationRequest{
		Name: "  Старый город  ", Kind: "settlement", ImagePresetKey: stringPointer("city"),
		SceneIDs: []int64{1, 2},
	}
	recorder := httptest.NewRecorder()
	mutation, ok := locationMutation(recorder, valid)
	if !ok {
		t.Fatalf("valid location rejected: %s", recorder.Body.String())
	}
	if mutation.Name != "Старый город" || mutation.Kind != "settlement" {
		t.Fatalf("unexpected mutation: %+v", mutation)
	}

	invalid := valid
	invalid.Kind = "planet"
	recorder = httptest.NewRecorder()
	if _, ok := locationMutation(recorder, invalid); ok {
		t.Fatal("unknown location kind accepted")
	}

	invalid = valid
	invalid.ImagePresetKey = stringPointer("remote-url")
	recorder = httptest.NewRecorder()
	if _, ok := locationMutation(recorder, invalid); ok {
		t.Fatal("unknown image preset accepted")
	}

	invalid = valid
	invalid.SceneIDs = []int64{1, 0}
	recorder = httptest.NewRecorder()
	if _, ok := locationMutation(recorder, invalid); ok {
		t.Fatal("non-positive scenario id accepted")
	}
}

func TestNpcMutationNormalizesColorAndText(t *testing.T) {
	role := "  Проводник  "
	note := "  Старый долг  "
	raceItemID := int64(42)
	recorder := httptest.NewRecorder()
	mutation, ok := npcMutation(recorder, npcMutationRequest{
		Name: "  Мира  ", RaceItemID: &raceItemID, Role: &role, Color: "#A06CE8",
		NPCLinks: []store.SessionNPCNPCLink{{NPCID: 7, Note: &note}},
	})
	if !ok {
		t.Fatalf("valid npc rejected: %s", recorder.Body.String())
	}
	if mutation.Name != "Мира" || mutation.RaceItemID == nil || *mutation.RaceItemID != 42 || mutation.Role == nil || *mutation.Role != "Проводник" || mutation.Color != "#a06ce8" {
		t.Fatalf("unexpected mutation: %+v", mutation)
	}
	if mutation.ImagePresetKey == nil || *mutation.ImagePresetKey != "npc-scholar" || mutation.NPCLinks[0].Note == nil || *mutation.NPCLinks[0].Note != "Старый долг" {
		t.Fatalf("unexpected image or NPC link mutation: %+v", mutation)
	}

	recorder = httptest.NewRecorder()
	if _, ok := npcMutation(recorder, npcMutationRequest{Name: "Мира", Color: "red"}); ok {
		t.Fatal("non-hex npc color accepted")
	}
	if !strings.Contains(recorder.Body.String(), "цвет") {
		t.Fatalf("unexpected error: %s", recorder.Body.String())
	}

	invalidRaceID := int64(0)
	recorder = httptest.NewRecorder()
	if _, ok := npcMutation(recorder, npcMutationRequest{Name: "Мира", RaceItemID: &invalidRaceID}); ok {
		t.Fatal("non-positive race item id accepted")
	}
}

func stringPointer(value string) *string { return &value }
