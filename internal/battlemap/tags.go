package battlemap

import (
	"fmt"
	"strings"
)

func validateMapTags(d *Document) error {
	if len(d.Tags) > 32 {
		return fmt.Errorf("У карты может быть до 32 тегов")
	}
	tags := []string{}
	seen := map[string]bool{}
	for _, raw := range d.Tags {
		tag := strings.Join(strings.Fields(raw), " ")
		if tag == "" {
			continue
		}
		if len([]rune(tag)) > 64 {
			return fmt.Errorf("Тег карты: не более 64 символов")
		}
		key := strings.ToLower(tag)
		if !seen[key] {
			tags = append(tags, tag)
			seen[key] = true
		}
	}
	d.Tags = tags
	return nil
}
