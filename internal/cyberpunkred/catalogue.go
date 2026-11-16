package cyberpunkred

import (
	"crypto/sha256"
	_ "embed"
	"encoding/json"
	"fmt"
)

// Core is an explicit import package. Startup never installs catalogue rows.
//
//go:embed core.json
var coreJSON []byte

type CatalogueItem struct {
	Key      string         `json:"key"`
	Category string         `json:"category"`
	Name     string         `json:"name"`
	NameEn   string         `json:"nameEn"`
	Page     int            `json:"page"`
	Kind     string         `json:"kind"`
	Summary  string         `json:"summary"`
	Facts    map[string]any `json:"facts"`
}
type Catalogue struct {
	Revision     string                       `json:"revision"`
	Source       string                       `json:"source"`
	Groups       map[string]string            `json:"groups"`
	Items        []CatalogueItem              `json:"items"`
	Dictionaries map[string][]DictionaryEntry `json:"dictionaries"`
}
type DictionaryEntry struct {
	Key         string `json:"key"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

func Core() (Catalogue, error) {
	var result Catalogue
	err := json.Unmarshal(coreJSON, &result)
	return result, err
}
func CoreHash() string { return fmt.Sprintf("%x", sha256.Sum256(coreJSON)) }
