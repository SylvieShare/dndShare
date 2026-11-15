package web

import (
	"encoding/json"
	"errors"
	"strings"
	"unicode/utf8"
)

// Reserve tabs are optional organizational metadata. The permanent default tab
// is implicit; absent or removed home IDs display in that default reserve.
func validateEncounterReserves(raw json.RawMessage) error {
	var doc struct {
		Tabs []struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		} `json:"reserveTabs"`
		Combatants []map[string]json.RawMessage `json:"combatants"`
	}
	invalid := errors.New("Некорректные вкладки запасов")
	if json.Unmarshal(raw, &doc) != nil {
		return invalid
	}
	ids := map[string]bool{"default": true}
	for _, tab := range doc.Tabs {
		if tab.ID == "" || tab.ID != strings.TrimSpace(tab.ID) || len(tab.ID) > 128 || ids[tab.ID] || strings.TrimSpace(tab.Name) == "" || utf8.RuneCountInString(tab.Name) > 255 {
			return invalid
		}
		ids[tab.ID] = true
	}
	for _, row := range doc.Combatants {
		value, ok := row["reserveTabId"]
		if !ok {
			continue
		}
		var id, kind string
		if json.Unmarshal(value, &id) != nil || len(id) > 128 {
			return invalid
		}
		if id == "" {
			continue
		}
		if json.Unmarshal(row["type"], &kind) != nil || kind != "npc" {
			return invalid
		}
	}
	return nil
}
