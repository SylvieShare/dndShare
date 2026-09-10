package web

import (
	"encoding/json"
	"strings"
)

func validJournalQuestPayload(raw json.RawMessage) bool {
	var payload struct {
		Quest *struct {
			Reward     string `json:"reward"`
			Objectives []struct {
				ID   string `json:"id"`
				Text string `json:"text"`
				Done bool   `json:"done"`
			} `json:"objectives"`
		} `json:"quest"`
	}
	if json.Unmarshal(raw, &payload) != nil || payload.Quest == nil {
		return false
	}
	quest := payload.Quest
	if len(quest.Objectives) > 100 || len([]rune(quest.Reward)) > 2000 {
		return false
	}
	ids := make(map[string]bool)
	for _, row := range quest.Objectives {
		if strings.TrimSpace(row.ID) == "" || len(row.ID) > 100 || ids[row.ID] || strings.TrimSpace(row.Text) == "" || len([]rune(row.Text)) > 500 {
			return false
		}
		ids[row.ID] = true
	}
	return true
}
