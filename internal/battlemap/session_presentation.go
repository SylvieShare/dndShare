package battlemap

import "fmt"

// SessionLighting overrides presentation without changing the library document.
type SessionLighting struct {
	Enabled bool            `json:"enabled"`
	Sun     SunLight        `json:"sun"`
	Lights  map[string]bool `json:"lights"`
}

func validateSessionPresentation(s State, d Document) error {
	areas := map[string]bool{}
	for _, area := range d.Areas {
		areas[area.ID] = true
	}
	for id := range s.Areas {
		if !areas[id] {
			return fmt.Errorf("Неизвестная область")
		}
	}
	if s.Lighting == nil {
		return nil
	}
	if s.Lighting.Lights == nil {
		s.Lighting.Lights = map[string]bool{}
	}
	if !bounded(s.Lighting.Sun.Angle, 0, 360) || !bounded(s.Lighting.Sun.Elevation, 10, 85) {
		return fmt.Errorf("Некорректные настройки дневного освещения")
	}
	lights := map[string]bool{}
	shadows := 0
	for _, light := range d.Lights {
		lights[light.ID] = true
		enabled := light.Enabled
		if override, ok := s.Lighting.Lights[light.ID]; ok {
			enabled = override
		}
		if enabled && light.Shadows {
			shadows++
		}
	}
	for id := range s.Lighting.Lights {
		if !lights[id] {
			return fmt.Errorf("Неизвестный источник света")
		}
	}
	if shadows > 2 {
		return fmt.Errorf("Тени могут создавать не более двух локальных источников")
	}
	return nil
}
