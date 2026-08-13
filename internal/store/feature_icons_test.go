package store

import (
	"encoding/xml"
	"regexp"
	"strings"
	"testing"
)

var featureIconMappingPattern = regexp.MustCompile(`\((3|7), '([^']+)', '(item-(?:race|feat)-[^']+)'\)`)

func TestFeatureIconSeedIsCompleteAndValid(t *testing.T) {
	definitions := map[string]bool{}
	for _, match := range itemIconDefinitionPattern.FindAllStringSubmatch(schemaFeatureIconsSQL, -1) {
		key, svg := match[1], match[2]
		if definitions[key] {
			t.Fatalf("duplicate feature icon definition %q", key)
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
	if len(definitions) != 103 {
		t.Fatalf("got %d feature icon definitions, want 103", len(definitions))
	}

	seenItems := map[string]bool{}
	racialCount, featCount := 0, 0
	for _, match := range featureIconMappingPattern.FindAllStringSubmatch(schemaFeatureIconsSQL, -1) {
		typeID, name, iconKey := match[1], match[2], match[3]
		if !definitions[iconKey] {
			t.Fatalf("feature %q references undefined icon %q", name, iconKey)
		}
		itemKey := typeID + ":" + strings.ToLower(name)
		if seenItems[itemKey] {
			t.Fatalf("duplicate feature icon mapping %q", itemKey)
		}
		seenItems[itemKey] = true
		if typeID == "3" {
			racialCount++
		} else {
			featCount++
		}
	}
	if racialCount != 25 || featCount != 40 {
		t.Fatalf("got %d racial-trait and %d feat mappings, want 25 and 40", racialCount, featCount)
	}

	for _, iconKey := range []string{"item-class-feature", "item-class-magic", "item-class-defense", "item-class-attack"} {
		if !definitions[iconKey] {
			t.Fatalf("missing class feature icon %q", iconKey)
		}
	}
	for _, guard := range []string{"i.user_id IS NULL", "i.icon_svg_id IS NULL", "i.icon_image_id IS NULL", "i.type_id = 4"} {
		if !strings.Contains(schemaFeatureIconsSQL, guard) {
			t.Fatalf("feature icon seed must contain guard %q", guard)
		}
	}
}
