package store

import (
	"bytes"
	"dndshare/internal/documentpatch"
	"encoding/json"
)

type CharacterRollPrecondition struct {
	Path   []any           `json:"path"`
	Exists bool            `json:"exists"`
	Value  json.RawMessage `json:"value"`
}

func (p *CharacterRollPrecondition) UnmarshalJSON(raw []byte) error {
	type wire CharacterRollPrecondition
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	return d.Decode((*wire)(p))
}

type CharacterRollSpec struct {
	Title             string         `json:"title"`
	Kind              string         `json:"kind"`
	Formula           *string        `json:"formula,omitempty"`
	Ability           *int64         `json:"ability,omitempty"`
	TargetUID         string         `json:"targetUid"`
	SourceItemID      *int64         `json:"sourceItemId,omitempty"`
	SourceName        string         `json:"sourceName"`
	CriticalThreshold int            `json:"criticalThreshold"`
	EventData         map[string]any `json:"eventData"`
}

type PreparedCharacterD20 struct {
	Request         CharacterRollSpec `json:"request"`
	Mode            string            `json:"mode"`
	Flat            int               `json:"flat"`
	BonusDice       []int             `json:"bonusDice"`
	BonusTotal      int               `json:"bonusTotal"`
	BonusParts      []map[string]any  `json:"bonusParts"`
	MinimumRule     map[string]any    `json:"minimumRule"`
	Sources         []string          `json:"sources"`
	BonusExpression string            `json:"bonusExpression"`
}

type CharacterRollWeaponUse struct {
	UID      string          `json:"uid"`
	Start    map[string]any  `json:"start,omitempty"`
	ID       string          `json:"id,omitempty"`
	Previous json.RawMessage `json:"previous,omitempty"`
}

type CharacterRollRequest struct {
	WeaponUse      *CharacterRollWeaponUse     `json:"weaponUse,omitempty"`
	Version        int64                       `json:"version"`
	ClientActionID string                      `json:"clientActionId"`
	SessionUUID    string                      `json:"sessionUuid"`
	Prepared       PreparedCharacterD20        `json:"prepared"`
	Patches        []documentpatch.Operation   `json:"patches"`
	Before         []CharacterRollPrecondition `json:"before"`
}

type CharacterRollResult struct {
	Version int64          `json:"version"`
	Roll    map[string]any `json:"roll"`
	EventID int64          `json:"eventId"`
}
