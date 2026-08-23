package web

import "testing"

func TestMCPPublishesSessionAdventureTools(t *testing.T) {
	wanted := map[string]bool{
		"sessions_list":            false,
		"session_adventure_get":    false,
		"session_adventure_import": false,
	}
	for _, definition := range mcpToolDefs() {
		name, _ := definition["name"].(string)
		if _, ok := wanted[name]; ok {
			wanted[name] = true
		}
	}
	for name, found := range wanted {
		if !found {
			t.Fatalf("MCP tool %q is not published", name)
		}
	}
}
