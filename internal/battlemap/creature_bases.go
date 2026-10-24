package battlemap

import "fmt"

// Assignments remain valid when bases are disabled so re-enabling keeps the
// same choice. The caller supplies sizes only for registered creature bases.
func ValidateCreatureBaseAssignments(state State, sizes map[string]float64) error {
	for _, token := range state.Tokens {
		if token.BaseModelID != "" && (token.Kind != "creature" || sizes[token.BaseModelID] != token.Size) {
			return fmt.Errorf("Подставка не соответствует размеру существа")
		}
	}
	return nil
}
