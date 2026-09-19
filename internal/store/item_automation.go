package store

import (
	"errors"
	"strings"
	"unicode/utf8"
)

// ItemAutomation is catalogue metadata shared by all item types, never instance rules.
type ItemAutomation struct {
	AutomationStatus          string `json:"automationStatus"`
	AutomationNote            string `json:"automationNote"`
	RequiresPlayerInteraction bool   `json:"requiresPlayerInteraction"`
}

// ItemMetadataPatch preserves omitted values when updating through HTTP or MCP.
type ItemMetadataPatch struct {
	ParentID                  *int64               `json:"-"` // MCP: negative removes parent, nil preserves it.
	DerivedFromItemID         *int64               `json:"derivedFromItemId"`
	DerivationKind            *string              `json:"derivationKind"`
	Compatibility             *[]ItemCompatibility `json:"compatibility"`
	Hidden                    *bool                `json:"hidden"`
	AutomationStatus          *string              `json:"automationStatus"`
	AutomationNote            *string              `json:"automationNote"`
	RequiresPlayerInteraction *bool                `json:"requiresPlayerInteraction"`
}

func (p *ItemMetadataPatch) Validate() error {
	if (p.DerivedFromItemID == nil) != (p.DerivationKind == nil) {
		return errors.New("Исходная запись и тип варианта указываются вместе")
	}
	if p.Compatibility != nil {
		if err := ValidateItemCompatibility(*p.Compatibility); err != nil {
			return err
		}
	}
	if p.AutomationStatus != nil {
		switch *p.AutomationStatus {
		case "unreviewed", "full", "partial", "none", "not_applicable":
		default:
			return errors.New("Неизвестный статус автоматизации")
		}
	}
	if p.AutomationNote != nil {
		note := strings.TrimSpace(*p.AutomationNote)
		if utf8.RuneCountInString(note) > 1000 {
			return errors.New("Комментарий об автоматизации: не более 1000 символов")
		}
		p.AutomationNote = &note
	}
	return nil
}

func (p ItemMetadataPatch) Initial() ItemAutomation {
	result := ItemAutomation{AutomationStatus: "unreviewed"}
	if p.AutomationStatus != nil {
		result.AutomationStatus = *p.AutomationStatus
	}
	if p.AutomationNote != nil {
		result.AutomationNote = *p.AutomationNote
	}
	if p.RequiresPlayerInteraction != nil {
		result.RequiresPlayerInteraction = *p.RequiresPlayerInteraction
	}
	return result
}
