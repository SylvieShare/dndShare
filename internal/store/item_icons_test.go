package store

import (
	"encoding/xml"
	"regexp"
	"strings"
	"testing"
)

var (
	itemIconDefinitionPattern = regexp.MustCompile(`\('([^']+)', '(<svg[^']+</svg>)'\)`)
	itemIconMappingPattern    = regexp.MustCompile(`\((1|2), '([^']+)', '([^']+)'\)`)
)

func TestItemIconSeedIsCompleteAndValid(t *testing.T) {
	definitions := map[string]bool{}
	for _, match := range itemIconDefinitionPattern.FindAllStringSubmatch(schemaItemIconsSQL, -1) {
		key, svg := match[1], match[2]
		if definitions[key] {
			t.Fatalf("duplicate item icon definition %q", key)
		}
		definitions[key] = true
		var document struct {
			XMLName xml.Name
		}
		if err := xml.Unmarshal([]byte(svg), &document); err != nil {
			t.Fatalf("invalid SVG for %q: %v", key, err)
		}
		if document.XMLName.Local != "svg" {
			t.Fatalf("icon %q has root <%s>, want <svg>", key, document.XMLName.Local)
		}
	}
	if len(definitions) != 84 {
		t.Fatalf("got %d item icon definitions, want 84", len(definitions))
	}

	seenItems := map[string]bool{}
	weaponCount, equipmentCount := 0, 0
	for _, match := range itemIconMappingPattern.FindAllStringSubmatch(schemaItemIconsSQL, -1) {
		typeID, name, iconKey := match[1], match[2], match[3]
		if !definitions[iconKey] {
			t.Fatalf("item %q references undefined icon %q", name, iconKey)
		}
		itemKey := typeID + ":" + strings.ToLower(name)
		if seenItems[itemKey] {
			t.Fatalf("duplicate item icon mapping %q", itemKey)
		}
		seenItems[itemKey] = true
		if typeID == "1" {
			weaponCount++
		} else {
			equipmentCount++
		}
	}
	if weaponCount != 38 || equipmentCount != 127 {
		t.Fatalf("got %d weapon and %d equipment mappings, want 38 and 127", weaponCount, equipmentCount)
	}

	for _, guard := range []string{"i.user_id IS NULL", "i.icon_svg_id IS NULL", "i.icon_image_id IS NULL"} {
		if !strings.Contains(schemaItemIconsSQL, guard) {
			t.Fatalf("item icon seed must contain guard %q", guard)
		}
	}
}
