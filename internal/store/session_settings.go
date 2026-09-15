package store

import (
	"context"
	"fmt"
)

type SessionSettings struct {
	PlayersSeeClass   bool `json:"playersSeeClass"`
	PlayersSeeRace    bool `json:"playersSeeRace"`
	PlayersSeeHP      bool `json:"playersSeeHp"`
	PlayersOpenSheets bool `json:"playersOpenSheets"`
}

var sessionSettingColumns = map[string]string{
	"playersSeeClass":   "players_see_class",
	"playersSeeRace":    "players_see_race",
	"playersSeeHp":      "players_see_hp",
	"playersOpenSheets": "players_open_sheets",
}

func ValidSessionSetting(key string) bool { _, ok := sessionSettingColumns[key]; return ok }

func (s *Store) UpdateSessionSetting(ctx context.Context, sessionID int64, key string, value bool) error {
	column, ok := sessionSettingColumns[key]
	if !ok {
		return fmt.Errorf("unknown session setting %q", key)
	}
	_, err := s.pool.Exec(ctx, `UPDATE dndshare."session" SET `+column+` = $2, changed_at = now() WHERE id = $1 AND deleted = false`, sessionID, value)
	return err
}

// SessionParticipantView exposes only roster fields to other players. Nested
// handbook references are reduced to names so their mechanics cannot leak HP.
func SessionParticipantView(p SessionParticipantData, settings SessionSettings, viewerID int64, dm bool) SessionParticipantData {
	own := p.UserID == viewerID
	p.CanOpenSheet = dm || own || (settings.PlayersOpenSheets && p.PublicVisible)
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
	if settings.PlayersSeeRace {
		visible["race"] = participantReferenceName(values["race"])
	}
	if settings.PlayersSeeClass {
		classes := []any{}
		if entries, ok := values["classes"].([]any); ok {
			for _, entry := range entries {
				classes = append(classes, participantReferenceName(entry))
			}
		}
		visible["classes"] = classes
	}
	if settings.PlayersSeeHP {
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
