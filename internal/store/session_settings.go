package store

import (
	"context"
	"encoding/json"
	"fmt"
)

type SessionSettings struct {
	Interactions SessionInteractionSettings `json:"interactions"`
	AutoAccept   SessionAutoAcceptSettings  `json:"autoAccept"`
	Players      SessionPlayerSettings      `json:"players"`
	Combat       SessionCombatSettings      `json:"combat"`
}

type SessionInteractionSettings struct {
	Items   bool `json:"items"`
	Potions bool `json:"potions"`
	Spells  bool `json:"spells"`
}

type SessionAutoAcceptSettings struct {
	Items   bool `json:"items"`
	Potions bool `json:"potions"`
	Spells  bool `json:"spells"`
}

type SessionPlayerSettings struct {
	SeeClass   bool `json:"seeClass"`
	SeeRace    bool `json:"seeRace"`
	SeeHP      bool `json:"seeHp"`
	OpenSheets bool `json:"openSheets"`
}

type SessionCombatSettings struct {
	AutoRollNpcHP bool `json:"autoRollNpcHp"`
}

var sessionSettingPaths = map[string][]string{
	"interactions.items":   {"interactions", "items"},
	"interactions.potions": {"interactions", "potions"},
	"interactions.spells":  {"interactions", "spells"},
	"autoAccept.items":     {"autoAccept", "items"},
	"autoAccept.potions":   {"autoAccept", "potions"},
	"autoAccept.spells":    {"autoAccept", "spells"},
	"players.seeClass":     {"players", "seeClass"},
	"players.seeRace":      {"players", "seeRace"},
	"players.seeHp":        {"players", "seeHp"},
	"players.openSheets":   {"players", "openSheets"},
	"combat.autoRollNpcHp": {"combat", "autoRollNpcHp"},
}

func ValidSessionSetting(key string) bool { _, ok := sessionSettingPaths[key]; return ok }

// Update only the selected leaf, preserving other settings and future sections.
func (s *Store) UpdateSessionSetting(ctx context.Context, sessionID int64, key string, value bool) error {
	path, ok := sessionSettingPaths[key]
	if !ok {
		return fmt.Errorf("unknown session setting %q", key)
	}
	encoded, err := json.Marshal(value)
	if err != nil {
		return err
	}
	tag, err := s.pool.Exec(ctx, `UPDATE dndshare."session"
 SET settings = jsonb_set(settings, $2::text[], CAST($3 AS jsonb)), changed_at = now()
 WHERE id = $1 AND deleted = false`, sessionID, path, json.RawMessage(encoded))
	if err == nil && tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return err
}

// SessionParticipantView exposes only roster fields to other players. Nested
// handbook references are reduced to names so their mechanics cannot leak HP.
func SessionParticipantView(p SessionParticipantData, settings SessionSettings, viewerID int64, dm bool) SessionParticipantData {
	own := p.UserID == viewerID
	p.CanOpenSheet = dm || own || (settings.Players.OpenSheets && p.PublicVisible)
	if dm || own {
		return p
	}
	values, _ := p.Data["values"].(map[string]any)
	visible := map[string]any{}
	for _, key := range []string{"name", "char_name", "persona"} {
		if value, ok := values[key].(string); ok {
			visible[key] = value
		}
	}
	if ava, ok := values["ava"].(map[string]any); ok {
		visible["ava"] = map[string]any{"url": ava["url"]}
	}
	if settings.Players.SeeRace {
		visible["race"] = participantReferenceName(values["race"])
	}
	if settings.Players.SeeClass {
		classes := []any{}
		if entries, ok := values["classes"].([]any); ok {
			for _, entry := range entries {
				classes = append(classes, participantReferenceName(entry))
			}
		}
		visible["classes"] = classes
	}
	if settings.Players.SeeHP {
		if hp, ok := values["hp"].(map[string]any); ok {
			// Preserve the canonical maximum calculation, but strip bonus descriptions.
			maximum := hp["max"]
			if raw, ok := maximum.(map[string]any); ok {
				bonuses := []any{}
				if entries, ok := raw["bonuses"].([]any); ok {
					for _, entry := range entries {
						if bonus, ok := entry.(map[string]any); ok {
							bonuses = append(bonuses, map[string]any{"value": bonus["value"]})
						}
					}
				}
				maximum = map[string]any{"base": raw["base"], "bonuses": bonuses}
			}
			visible["hp"] = map[string]any{"current": hp["current"], "max": maximum, "temp": hp["temp"]}
		}
	}
	p.Data = map[string]any{"values": visible}
	return p
}

func participantReferenceName(value any) map[string]any {
	if ref, ok := value.(map[string]any); ok {
		if name, ok := ref["name"].(string); ok {
			return map[string]any{"name": name}
		}
	}
	return nil
}
