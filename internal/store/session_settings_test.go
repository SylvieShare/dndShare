package store

import (
	"encoding/json"
	"reflect"
	"testing"
)

func TestSessionParticipantVisibility(t *testing.T) {
	var data map[string]any
	if err := json.Unmarshal([]byte(`{"values":{"name":"Hero","ava":{"url":"avatar"},"race":{"name":"Elf","data":{"secret":"race mechanics"}},"classes":[{"name":"Wizard","data":{"secret":"class mechanics"}}],"hp":{"current":8,"max":{"base":10,"bonuses":[{"value":2,"name":"secret"}]},"temp":3,"hitDice":"secret"},"diary":"secret","inventory":"secret"},"var":{"secret":true}}`), &data); err != nil {
		t.Fatal(err)
	}
	original, _ := json.Marshal(data)
	participant := SessionParticipantData{UserID: 5, Data: data, PublicVisible: true}
	for mask := 0; mask < 16; mask++ {
		settings := SessionSettings{Players: SessionPlayerSettings{SeeClass: mask&1 != 0, SeeRace: mask&2 != 0, SeeHP: mask&4 != 0, OpenSheets: mask&8 != 0}}
		got := SessionParticipantView(participant, settings, 8, false)
		values := got.Data["values"].(map[string]any)
		for key, allowed := range map[string]bool{"classes": settings.Players.SeeClass, "race": settings.Players.SeeRace, "hp": settings.Players.SeeHP} {
			if _, present := values[key]; present != allowed {
				t.Fatalf("mask %d: %s present=%v", mask, key, present)
			}
		}
		if got.CanOpenSheet != settings.Players.OpenSheets {
			t.Fatalf("mask %d: sheet access", mask)
		}
		if values["name"] != "Hero" || values["diary"] != nil || values["inventory"] != nil || got.Data["var"] != nil {
			t.Fatalf("bad projection: %+v", got.Data)
		}
		if settings.Players.SeeHP && !reflect.DeepEqual(values["hp"], map[string]any{"current": float64(8), "max": map[string]any{"base": float64(10), "bonuses": []any{map[string]any{"value": float64(2)}}}, "temp": float64(3)}) {
			t.Fatalf("bad HP: %+v", values["hp"])
		}
	}
	after, _ := json.Marshal(data)
	if string(original) != string(after) {
		t.Fatal("projection mutated original character")
	}
	for _, reader := range []struct {
		id int64
		dm bool
	}{{5, false}, {8, true}} {
		got := SessionParticipantView(participant, SessionSettings{}, reader.id, reader.dm)
		if !got.CanOpenSheet || !reflect.DeepEqual(got.Data, data) {
			t.Fatal("owner or DM lost access")
		}
	}
	participant.PublicVisible = false
	if SessionParticipantView(participant, SessionSettings{Players: SessionPlayerSettings{OpenSheets: true}}, 8, false).CanOpenSheet {
		t.Fatal("peer can open private sheet")
	}
}

func TestSessionSettingKeys(t *testing.T) {
	for _, key := range []string{"players.seeClass", "players.seeRace", "players.seeHp", "players.openSheets", "combat.autoRollNpcHp"} {
		if !ValidSessionSetting(key) {
			t.Fatalf("missing setting %s", key)
		}
	}
	for _, key := range []string{"", "ownerUserId", "autoRollNpcHp", "players_see_hp"} {
		if ValidSessionSetting(key) {
			t.Fatalf("accepted invalid key %s", key)
		}
	}
}
