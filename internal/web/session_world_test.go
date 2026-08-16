package web

import (
	"net/http/httptest"
	"strings"
	"testing"

	"dndshare/internal/store"
)

func TestLocationMutationValidatesKindAndImage(t *testing.T) {
	valid := locationMutationRequest{
		Name: "  Старый город  ", Kind: "settlement", ImageID: 12,
		Relations: []store.SessionEntityRelation{{Type: store.SessionEntityScene, ID: 2}},
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
	invalid.ImageID = 0
	recorder = httptest.NewRecorder()
	if _, ok := locationMutation(recorder, invalid); ok {
		t.Fatal("non-positive image id accepted")
	}

}

func TestNpcMutationNormalizesColorAndText(t *testing.T) {
	role := "  Проводник  "
	note := "  Старый долг  "
	raceItemID := int64(42)
	recorder := httptest.NewRecorder()
	mutation, ok := npcMutation(recorder, npcMutationRequest{
		Name: "  Мира  ", RaceItemID: &raceItemID, Role: &role, Color: "#A06CE8",
		ImageID:   25,
		Relations: []store.SessionEntityRelation{{Type: "npc", ID: 7, Note: &note}},
	})
	if !ok {
		t.Fatalf("valid npc rejected: %s", recorder.Body.String())
	}
	if mutation.Name != "Мира" || mutation.RaceItemID == nil || *mutation.RaceItemID != 42 || mutation.Role == nil || *mutation.Role != "Проводник" || mutation.Color != "#a06ce8" {
		t.Fatalf("unexpected mutation: %+v", mutation)
	}
	if mutation.ImageID != 25 || mutation.Relations[0].Note == nil || *mutation.Relations[0].Note != "Старый долг" {
		t.Fatalf("unexpected image or NPC link mutation: %+v", mutation)
	}

	recorder = httptest.NewRecorder()
	if _, ok := npcMutation(recorder, npcMutationRequest{Name: "Мира", Color: "red", ImageID: 25}); ok {
		t.Fatal("non-hex npc color accepted")
	}
	if !strings.Contains(recorder.Body.String(), "цвет") {
		t.Fatalf("unexpected error: %s", recorder.Body.String())
	}

	invalidRaceID := int64(0)
	recorder = httptest.NewRecorder()
	if _, ok := npcMutation(recorder, npcMutationRequest{Name: "Мира", RaceItemID: &invalidRaceID, ImageID: 25}); ok {
		t.Fatal("non-positive race item id accepted")
	}
}

func TestQuestMutationNormalizesStructuredDetails(t *testing.T) {
	goal := "  Найти пропавший караван  "
	condition := "  До наступления ночи  "
	reward := "  200 золотых  "
	consequences := "  Гильдия закроет тракт  "
	notes := "  Засада у старого моста  "
	recorder := httptest.NewRecorder()
	mutation, ok := questMutation(recorder, questMutationRequest{
		Name: "  Следы на тракте  ", Goal: &goal, Condition: &condition,
		Reward: &reward, Consequences: &consequences, Notes: &notes,
	})
	if !ok {
		t.Fatalf("valid quest rejected: %s", recorder.Body.String())
	}
	if mutation.Name != "Следы на тракте" || mutation.Status != "planned" {
		t.Fatalf("unexpected quest identity: %+v", mutation)
	}
	if mutation.Goal == nil || *mutation.Goal != "Найти пропавший караван" ||
		mutation.Condition == nil || *mutation.Condition != "До наступления ночи" ||
		mutation.Reward == nil || *mutation.Reward != "200 золотых" ||
		mutation.Consequences == nil || *mutation.Consequences != "Гильдия закроет тракт" ||
		mutation.Notes == nil || *mutation.Notes != "Засада у старого моста" {
		t.Fatalf("quest details were not normalized: %+v", mutation)
	}
}
