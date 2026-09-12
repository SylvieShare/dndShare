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

// ItemAutomationPatch preserves omitted values when updating through HTTP or MCP.
type ItemAutomationPatch struct {
	AutomationStatus          *string `json:"automationStatus"`
	AutomationNote            *string `json:"automationNote"`
	RequiresPlayerInteraction *bool   `json:"requiresPlayerInteraction"`
}

func (p *ItemAutomationPatch) Validate() error {
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

func (p ItemAutomationPatch) Initial() ItemAutomation {
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
