package web

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

type scenarioJournalData struct {
	Text string `json:"text"`
	Note string `json:"note"`
	Rows []struct {
		Left  string `json:"left"`
		Right string `json:"right"`
	} `json:"rows"`
	Creatures []map[string]any `json:"creatures"`
}

func scenarioJournalMutation(item store.SessionSceneItem, scene store.SessionScene) store.JournalEntryMutation {
	data := scenarioJournalData{}
	if item.Data != nil {
		_ = json.Unmarshal(*item.Data, &data)
	}
	typeName := "event"
	payload := map[string]any{}
	description := firstJournalText(data.Text, data.Note)
	switch item.Type {
	case "list":
		typeName = "dialog"
		dialogue := make([]map[string]any, 0, len(data.Rows))
		for index, row := range data.Rows {
			if strings.TrimSpace(row.Left) == "" && strings.TrimSpace(row.Right) == "" {
				continue
			}
			dialogue = append(dialogue, map[string]any{
				"id":      "scenario-" + stringID(item.ID) + "-line-" + stringID(int64(index+1)),
				"speaker": row.Left,
				"text":    row.Right,
			})
		}
		payload["dialogue"] = dialogue
	case "combat":
		typeName = "battle"
		combatants := make([]map[string]any, 0, len(data.Creatures))
		for index, creature := range data.Creatures {
			entry := map[string]any{
				"id":     "scenario-" + stringID(item.ID) + "-creature-" + stringID(int64(index+1)),
				"count":  creature["count"],
				"source": "custom",
			}
			if creature["kind"] == "handbook" {
				entry["source"] = "handbook"
				entry["itemId"] = creature["itemId"]
			} else {
				entry["name"] = creature["name"]
				entry["ac"] = creature["ac"]
				entry["hp"] = creature["hp"]
				entry["desc"] = creature["description"]
			}
			combatants = append(combatants, entry)
		}
		payload["combatants"] = combatants
	}
	payloadJSON, _ := json.Marshal(payload)
	snapshotJSON, _ := json.Marshal(map[string]any{
		"block": item,
		"scene": map[string]any{"id": scene.ID, "name": scene.Name},
	})
	return store.JournalEntryMutation{
		Type: typeName, Title: journalTruncate(strings.TrimSpace(item.Title), 255), Description: description,
		Payload: payloadJSON, SourceSceneItemID: &item.ID, SourceSnapshot: snapshotJSON,
	}
}

func firstJournalText(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func stringID(value int64) string {
	return strconv.FormatInt(value, 10)
}

func journalTruncate(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}

func (s *Server) handleAppendScenarioJournalItem(w http.ResponseWriter, r *http.Request) {
	userID, session, ok := s.requireSessionOwner(w, r)
	if !ok {
		return
	}
	itemID, ok := journalPathID(w, r, "itemId")
	if !ok {
		return
	}
	item, err := s.store.GetSceneItem(r.Context(), itemID)
	if err != nil {
		writeJournalError(w, err)
		return
	}
	scene, ok := s.requireSceneInSession(w, r, item.SceneID, session.ID)
	if !ok {
		return
	}
	journal, err := s.store.CreateSessionJournal(r.Context(), session.ID, journalTruncate("Дневник · "+session.Name, 160))
	if err != nil {
		serverError(w, err)
		return
	}
	sectionID := int64(0)
	if len(journal.Sections) > 0 {
		sectionID = journal.Sections[len(journal.Sections)-1].ID
	} else {
		sectionID, err = s.store.CreateJournalSection(r.Context(), journal.ID, scene.Name, "")
		if err != nil {
			serverError(w, err)
			return
		}
	}
	mutation := scenarioJournalMutation(item, scene)
	if mutation.Title == "" {
		mutation.Title = scene.Name
	}
	if _, err := s.store.CreateJournalEntry(r.Context(), journal.ID, sectionID, userID, mutation); err != nil {
		writeJournalError(w, err)
		return
	}
	s.writeReloadedJournal(w, r, journal.UUID, http.StatusCreated)
}
