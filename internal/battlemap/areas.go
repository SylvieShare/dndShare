package battlemap

import (
	"fmt"
	"strings"
)

func validateAreas(d *Document, tiles, objects map[string]bool) error {
	if len(d.Areas) > 200 {
		return fmt.Errorf("На карте может быть до 200 областей")
	}
	areaIDs, tileMembers, objectMembers := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for i := range d.Areas {
		a := &d.Areas[i]
		if !identifier.MatchString(a.ID) || areaIDs[a.ID] || strings.TrimSpace(a.Name) == "" || len([]rune(a.Name)) > 100 || len(a.TileIDs) > MaxTiles || len(a.ObjectIDs) > 1000 {
			return fmt.Errorf("Некорректная область карты")
		}
		areaIDs[a.ID] = true
		for _, id := range a.TileIDs {
			if !tiles[id] || tileMembers[id] {
				return fmt.Errorf("Плитка области отсутствует или уже входит в другую область")
			}
			tileMembers[id] = true
		}
		for _, id := range a.ObjectIDs {
			if !objects[id] || objectMembers[id] {
				return fmt.Errorf("Объект области отсутствует или уже входит в другую область")
			}
			objectMembers[id] = true
		}
		if a.TileIDs == nil {
			a.TileIDs = []string{}
		}
		if a.ObjectIDs == nil {
			a.ObjectIDs = []string{}
		}
	}
	if d.Areas == nil {
		d.Areas = []Area{}
	}
	return nil
}
