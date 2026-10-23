package web

import (
	"dndshare/internal/battlemap"
	"encoding/json"
	"net/http"
)

// Legacy placements can resolve their bestiary item without rewriting saved state.
// Only the read-only public projection is enriched; internal refs are stripped.
func (s *Server) publicMapTokenState(r *http.Request, sessionID int64, d battlemap.Document, state battlemap.State) (battlemap.State, error) {
	missing := false
	for _, t := range state.Tokens {
		if t.Kind == "creature" && t.ItemID == 0 && t.Ref != "" {
			missing = true
			break
		}
	}
	if missing {
		data, err := s.store.GetEncounterData(r.Context(), sessionID)
		if err != nil {
			return state, err
		}
		var encounter struct {
			Combatants []struct {
				UID    string `json:"uid"`
				ItemID int64  `json:"itemId"`
				Type   string `json:"type"`
			} `json:"combatants"`
		}
		if data != nil {
			if err = json.Unmarshal([]byte(*data), &encounter); err != nil {
				return state, err
			}
		}
		items := map[string]int64{}
		for _, c := range encounter.Combatants {
			if c.Type == "npc" {
				items[c.UID] = c.ItemID
			}
		}
		state.Tokens = append([]battlemap.Token(nil), state.Tokens...)
		for i := range state.Tokens {
			t := &state.Tokens[i]
			if t.Kind == "creature" && t.ItemID == 0 {
				t.ItemID = items[t.Ref]
			}
		}
	}
	return battlemap.PublicState(d, state), nil
}
