package web

import (
	"dndshare/internal/battlemap"
	"dndshare/internal/store"
	"encoding/json"
	"fmt"
	"net/http"
)

type mapCombatant struct {
	UID      string `json:"uid"`
	CharID   int64  `json:"charId"`
	ItemID   int64  `json:"itemId"`
	Type     string `json:"type"`
	Position string `json:"position"`
}

// Encounter owns life state. Enrich a rendering copy, never the saved map.
func encounterMapTokens(state battlemap.State, combatants []mapCombatant) battlemap.State {
	npcs := map[string]mapCombatant{}
	players := map[string]mapCombatant{}
	for _, c := range combatants {
		if c.Type == "npc" {
			npcs[c.UID] = c
		} else if c.Type == "player" {
			players[fmt.Sprint(c.CharID)] = c
		}
	}
	state.Tokens = append([]battlemap.Token(nil), state.Tokens...)
	for i := range state.Tokens {
		t := &state.Tokens[i]
		t.Dead = false
		if t.Kind == "creature" {
			c := npcs[t.Ref]
			t.Dead = c.Position == "dead"
			if t.ItemID == 0 {
				t.ItemID = c.ItemID
			}
		} else if t.Kind == "player" {
			t.Dead = players[t.Ref].Position == "dead"
		}
	}
	return state
}

func (s *Server) publicMapTokenState(r *http.Request, session store.GameSession, d battlemap.Document, state battlemap.State) (battlemap.State, error) {
	data, err := s.store.GetEncounterData(r.Context(), session.ID)
	if err != nil {
		return state, err
	}
	var encounter struct {
		Combatants []mapCombatant `json:"combatants"`
	}
	if data != nil {
		if err = json.Unmarshal([]byte(*data), &encounter); err != nil {
			return state, err
		}
	}
	state = battlemap.PublicState(d, encounterMapTokens(state, encounter.Combatants))
	ids := []int64{}
	for _, token := range state.Tokens {
		if token.Dead && token.Kind == "creature" && token.ImageURL == "" && token.ItemID > 0 {
			ids = append(ids, token.ItemID)
		}
	}
	if len(ids) > 0 {
		items, err := s.store.GetByIds(r.Context(), uniqueInt64s(ids), &session.OwnerUserID)
		if err != nil {
			return state, err
		}
		portraits := map[int64]string{}
		for _, item := range items {
			if item.IconImageURL != nil && *item.IconImageURL != "" {
				portraits[item.ID] = *item.IconImageURL
			} else if item.IconSVGID != nil {
				portraits[item.ID] = fmt.Sprintf("/api/svg/%d", *item.IconSVGID)
			}
		}
		for i := range state.Tokens {
			if state.Tokens[i].ImageURL == "" {
				state.Tokens[i].ImageURL = portraits[state.Tokens[i].ItemID]
			}
		}
	}
	return state, nil
}
