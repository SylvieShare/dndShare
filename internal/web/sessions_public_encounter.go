package web

import (
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"dndshare/internal/store"
)

const encounterStatesSuggestTypeID int64 = 9

func init() { registerRoutes((*Server).routesPublicEncounter) }

func (s *Server) routesPublicEncounter(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/public/sessions/{uuid}/encounter", s.handleGetPublicEncounter)
}

type publicEncounterResponse struct {
	SessionName string                     `json:"sessionName"`
	Active      bool                       `json:"active"`
	Round       int                        `json:"round"`
	CurrentUID  *string                    `json:"currentUid,omitempty"`
	Combatants  []publicEncounterCombatant `json:"combatants"`
	Graveyard   []publicEncounterGraveyard `json:"graveyard"`
}

type publicEncounterCombatant struct {
	UID           string                 `json:"uid"`
	Type          string                 `json:"type"`
	Name          string                 `json:"name"`
	AvatarURL     *string                `json:"avatarUrl,omitempty"`
	AvatarSVG     *string                `json:"avatarSvg,omitempty"`
	CoverImageURL *string                `json:"coverImageUrl,omitempty"`
	Color         *string                `json:"color,omitempty"`
	MarkerLetter  *string                `json:"markerLetter,omitempty"`
	Initiative    *int                   `json:"-"`
	Side          string                 `json:"side"`
	Surprised     bool                   `json:"surprised"`
	Health        publicEncounterHealth  `json:"health"`
	States        []publicEncounterState `json:"states"`
	tieBreak      int
	turnEligible  bool
}

type publicEncounterHealth struct {
	Kind    string   `json:"kind"`
	Label   string   `json:"label"`
	Current *float64 `json:"current,omitempty"`
	Maximum *float64 `json:"maximum,omitempty"`
}

type publicEncounterGraveyard struct {
	Key           string  `json:"key"`
	Name          string  `json:"name"`
	AvatarURL     *string `json:"avatarUrl,omitempty"`
	AvatarSVG     *string `json:"avatarSvg,omitempty"`
	CoverImageURL *string `json:"coverImageUrl,omitempty"`
	Color         *string `json:"color,omitempty"`
	Count         int     `json:"count"`
}

type publicEncounterState struct {
	Name  string  `json:"name"`
	Color *string `json:"color,omitempty"`
}

type rawPublicEncounter struct {
	Active     bool                 `json:"active"`
	Round      int                  `json:"round"`
	TurnIndex  int                  `json:"turnIndex"`
	Combatants []rawPublicCombatant `json:"combatants"`
}

type rawPublicCombatant struct {
	UID          string         `json:"uid"`
	Type         string         `json:"type"`
	CharID       int64          `json:"charId"`
	ItemID       *int64         `json:"itemId"`
	Position     string         `json:"position"`
	Initiative   *int           `json:"initiative"`
	TieBreak     int            `json:"tieBreak"`
	Surprised    bool           `json:"surprised"`
	Side         string         `json:"side"`
	IconColor    *string        `json:"iconColor"`
	MarkerLetter *string        `json:"markerLetter"`
	HPCurrent    *float64       `json:"hpCurrent"`
	States       []int64        `json:"states"`
	Override     map[string]any `json:"override"`
}

func (s *Server) handleGetPublicEncounter(w http.ResponseWriter, r *http.Request) {
	uuid := r.PathValue("uuid")
	if !isUUID(uuid) {
		notFound(w, "")
		return
	}
	session, err := s.store.GetGameSessionByUUID(r.Context(), uuid)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			notFound(w, "")
		} else {
			serverError(w, err)
		}
		return
	}

	data, err := s.store.GetEncounterData(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	encounter := rawPublicEncounter{}
	if data != nil && json.Unmarshal([]byte(*data), &encounter) != nil {
		serverError(w, errors.New("invalid encounter JSON"))
		return
	}

	participants, err := s.store.GetSessionParticipants(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}
	participantsByID := make(map[int64]store.SessionParticipantData, len(participants))
	for _, participant := range participants {
		participantsByID[participant.CharID] = participant
	}
	presentation, err := s.store.GetSessionPresentation(r.Context(), session.ID)
	if err != nil {
		serverError(w, err)
		return
	}

	itemIDs := make([]int64, 0)
	stateIDs := make([]int64, 0)
	for _, combatant := range encounter.Combatants {
		includeGraveyard := presentation.ShowGraveyard && combatant.Position == "dead" && combatant.Type == "npc"
		if combatant.Position != "combat" && !includeGraveyard {
			continue
		}
		if combatant.ItemID != nil {
			itemIDs = append(itemIDs, *combatant.ItemID)
		}
		if combatant.Position == "combat" {
			stateIDs = append(stateIDs, combatant.States...)
			if combatant.Type == "player" {
				stateIDs = append(stateIDs, participantStateIDs(participantsByID[combatant.CharID])...)
			}
		}
	}
	ownerID := session.OwnerUserID
	items, err := s.store.GetByIds(r.Context(), uniqueInt64s(itemIDs), &ownerID)
	if err != nil {
		serverError(w, err)
		return
	}
	itemsByID := make(map[int64]store.Item, len(items))
	for _, item := range items {
		itemsByID[item.ID] = item
	}

	states, err := s.store.GetSuggestsByIds(r.Context(), encounterStatesSuggestTypeID, uniqueInt64s(stateIDs), &ownerID)
	if err != nil {
		serverError(w, err)
		return
	}
	statesByID := make(map[int64]publicEncounterState, len(states))
	for _, state := range states {
		statesByID[state.ID] = publicEncounterState{Name: state.Value, Color: state.Color}
	}

	combatants := make([]publicEncounterCombatant, 0, len(encounter.Combatants))
	showHealthNumbers := presentation.ShowHealth && presentation.HealthDisplay == "numbers"
	for _, raw := range encounter.Combatants {
		if raw.Position != "combat" {
			continue
		}
		combatants = append(combatants, buildPublicCombatant(
			raw, participantsByID[raw.CharID], itemsByID, statesByID, encounter.Round, showHealthNumbers,
		))
	}
	sort.SliceStable(combatants, func(i, j int) bool {
		a, b := combatants[i], combatants[j]
		if a.Initiative == nil && b.Initiative == nil {
			return a.tieBreak < b.tieBreak
		}
		if a.Initiative == nil {
			return false
		}
		if b.Initiative == nil {
			return true
		}
		if *a.Initiative != *b.Initiative {
			return *a.Initiative > *b.Initiative
		}
		return a.tieBreak < b.tieBreak
	})

	var currentUID *string
	if encounter.Active {
		eligible := make([]publicEncounterCombatant, 0, len(combatants))
		for _, combatant := range combatants {
			if combatant.turnEligible {
				eligible = append(eligible, combatant)
			}
		}
		if len(eligible) > 0 {
			index := encounter.TurnIndex % len(eligible)
			if index < 0 {
				index += len(eligible)
			}
			uid := eligible[index].UID
			currentUID = &uid
		}
	}

	graveyard := []publicEncounterGraveyard{}
	if presentation.ShowGraveyard {
		groups := map[string]int{}
		for _, raw := range encounter.Combatants {
			if raw.Position != "dead" || raw.Type != "npc" {
				continue
			}
			combatant := buildPublicCombatant(raw, store.SessionParticipantData{}, itemsByID, nil, encounter.Round, false)
			key := "name:" + strings.ToLower(combatant.Name)
			if raw.ItemID != nil {
				key = "item:" + strconv.FormatInt(*raw.ItemID, 10)
			}
			if index, ok := groups[key]; ok {
				graveyard[index].Count++
				continue
			}
			groups[key] = len(graveyard)
			graveyard = append(graveyard, publicEncounterGraveyard{
				Key: key, Name: combatant.Name, AvatarURL: combatant.AvatarURL, AvatarSVG: combatant.AvatarSVG,
				CoverImageURL: combatant.CoverImageURL, Color: combatant.Color, Count: 1,
			})
		}
		sort.SliceStable(graveyard, func(i, j int) bool {
			return strings.ToLower(graveyard[i].Name) < strings.ToLower(graveyard[j].Name)
		})
	}

	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, publicEncounterResponse{
		SessionName: session.Name,
		Active:      encounter.Active,
		Round:       encounter.Round,
		CurrentUID:  currentUID,
		Combatants:  nonNil(combatants),
		Graveyard:   nonNil(graveyard),
	})
}

func buildPublicCombatant(raw rawPublicCombatant, participant store.SessionParticipantData, items map[int64]store.Item, states map[int64]publicEncounterState, round int, showHealth bool) publicEncounterCombatant {
	result := publicEncounterCombatant{
		UID:          raw.UID,
		Type:         raw.Type,
		Initiative:   raw.Initiative,
		Side:         raw.Side,
		Surprised:    raw.Surprised,
		MarkerLetter: raw.MarkerLetter,
		tieBreak:     raw.TieBreak,
		turnEligible: round != 0 || raw.Surprised,
		States:       []publicEncounterState{},
	}
	if result.Side == "" {
		result.Side = "enemy"
	}

	var stateIDs []int64
	if raw.Type == "player" {
		result.Name = participantName(participant)
		result.AvatarURL = participantAvatar(participant)
		result.Color = participant.Color
		current, maximum, known := participantHP(participant)
		result.Health = encounterHealth(current, maximum, known, showHealth)
		stateIDs = participantStateIDs(participant)
	} else {
		var item store.Item
		if raw.ItemID != nil {
			item = items[*raw.ItemID]
		}
		result.Name = npcPresentationName(raw, item)
		result.Color = raw.IconColor
		result.AvatarURL = item.IconImageURL
		result.AvatarSVG = item.SVG
		result.CoverImageURL = item.CoverImageURL
		maximum := npcMaximumHP(raw, item)
		current := maximum
		if raw.HPCurrent != nil {
			current = *raw.HPCurrent
		}
		result.Health = encounterHealth(current, maximum, maximum > 0, showHealth)
		result.turnEligible = result.turnEligible && current > 0
		stateIDs = raw.States
	}
	if strings.TrimSpace(result.Name) == "" {
		result.Name = "Без имени"
	}
	for _, id := range stateIDs {
		if state, ok := states[id]; ok {
			result.States = append(result.States, state)
		}
	}
	return result
}

func encounterHealth(current, maximum float64, known, showNumbers bool) publicEncounterHealth {
	if !known || maximum <= 0 {
		return publicEncounterHealth{Kind: "unknown", Label: "Неизвестно"}
	}
	health := publicEncounterHealth{}
	if showNumbers {
		health.Current = &current
		health.Maximum = &maximum
	}
	if current <= 0 {
		health.Kind, health.Label = "down", "При смерти"
		return health
	}
	ratio := current / maximum
	if ratio > 0.5 {
		health.Kind, health.Label = "healthy", "Здоров"
		return health
	}
	if ratio > 0.25 {
		health.Kind, health.Label = "wounded", "Ранен"
		return health
	}
	health.Kind, health.Label = "critical", "При смерти"
	return health
}

func participantName(participant store.SessionParticipantData) string {
	values := objectValue(participant.Data, "values")
	if participant.TemplateName == "VTM20" {
		return stringValue(values, "char_name")
	}
	return stringValue(values, "name")
}

func participantAvatar(participant store.SessionParticipantData) *string {
	values := objectValue(participant.Data, "values")
	avatar := stringValue(objectValue(values, "ava"), "url")
	if avatar == "" {
		return nil
	}
	return &avatar
}

func participantHP(participant store.SessionParticipantData) (float64, float64, bool) {
	if participant.TemplateName != "DND5" {
		return 0, 0, false
	}
	hp := objectValue(objectValue(participant.Data, "values"), "hp")
	maximum, ok := numberValue(hp, "max")
	if !ok || maximum <= 0 {
		return 0, 0, false
	}
	current, _ := numberValue(hp, "current")
	return current, maximum, true
}

func participantStateIDs(participant store.SessionParticipantData) []int64 {
	if participant.TemplateName != "DND5" {
		return nil
	}
	raw := objectValue(participant.Data, "values")["states"]
	return int64Slice(raw)
}

func npcPresentationName(raw rawPublicCombatant, item store.Item) string {
	if name := stringValue(raw.Override, "name"); name != "" {
		return name
	}
	return item.Name
}

func npcMaximumHP(raw rawPublicCombatant, item store.Item) float64 {
	if hp, ok := numberValue(raw.Override, "hp"); ok {
		return hp
	}
	var data map[string]any
	_ = json.Unmarshal(item.Data, &data)
	if hp, ok := numberValue(objectValue(data, "combat"), "hp"); ok {
		return hp
	}
	hp, _ := numberValue(data, "hp")
	return hp
}

func objectValue(data map[string]any, key string) map[string]any {
	value, _ := data[key].(map[string]any)
	if value == nil {
		return map[string]any{}
	}
	return value
}

func stringValue(data map[string]any, key string) string {
	value, _ := data[key].(string)
	return strings.TrimSpace(value)
}

func numberValue(data map[string]any, key string) (float64, bool) {
	value, ok := data[key]
	if !ok {
		return 0, false
	}
	switch number := value.(type) {
	case float64:
		return number, true
	case int:
		return float64(number), true
	case int64:
		return float64(number), true
	default:
		return 0, false
	}
}

func int64Slice(value any) []int64 {
	values, _ := value.([]any)
	result := make([]int64, 0, len(values))
	for _, value := range values {
		if number, ok := value.(float64); ok {
			result = append(result, int64(number))
		}
	}
	return result
}

func uniqueInt64s(values []int64) []int64 {
	seen := make(map[int64]struct{}, len(values))
	result := make([]int64, 0, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}
