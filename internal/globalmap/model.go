package globalmap

import (
	"fmt"
	"math"
	"regexp"
	"strings"
)

type Point struct {
	ID        string  `json:"id"`
	RefID     string  `json:"refId,omitempty"`
	Control   bool    `json:"control,omitempty"`
	X         float64 `json:"x"`
	Y         float64 `json:"y"`
	Name      string  `json:"name"`
	Note      string  `json:"note"`
	ChapterID *int64  `json:"chapterId,omitempty"`
}

type Route struct {
	ID        string  `json:"id"`
	RefID     string  `json:"refId,omitempty"`
	Control   bool    `json:"control,omitempty"`
	Name      string  `json:"name"`
	Color     string  `json:"color"`
	PlayerIDs []int64 `json:"playerIds"`
	Points    []Point `json:"points"`
}

var identifier = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)
var color = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

func Validate(name string, routes []Route) error {
	if strings.TrimSpace(name) == "" || len([]rune(name)) > 160 || len(routes) > 64 {
		return fmt.Errorf("Название карты обязательно, до 160 символов; до 64 маршрутов на карте")
	}
	ids := map[string]bool{}
	definitions := map[string]Point{}
	references := []Point{}
	total := 0
	for _, route := range routes {
		if !identifier.MatchString(route.ID) || ids[route.ID] || strings.TrimSpace(route.Name) == "" || len([]rune(route.Name)) > 120 || !color.MatchString(route.Color) || len(route.PlayerIDs) > 100 {
			return fmt.Errorf("Некорректный маршрут")
		}
		ids[route.ID] = true
		players := map[int64]bool{}
		for _, id := range route.PlayerIDs {
			if id <= 0 || players[id] {
				return fmt.Errorf("Некорректные игроки маршрута")
			}
			players[id] = true
		}
		if len(route.Points) > 0 && (route.Points[0].Control || route.Points[len(route.Points)-1].Control) {
			return fmt.Errorf("Узел изгиба должен находиться между точками маршрута")
		}
		for _, point := range route.Points {
			if !identifier.MatchString(point.ID) || ids[point.ID] || !coordinate(point.X) || !coordinate(point.Y) || len([]rune(point.Name)) > 100 || len([]rune(point.Note)) > 2000 || (point.ChapterID != nil && *point.ChapterID <= 0) {
				return fmt.Errorf("Некорректная точка: координаты от 0 до 1, название до 100 и заметка до 2000 символов")
			}
			if point.RefID != "" {
				if !identifier.MatchString(point.RefID) || point.Control || point.X != 0 || point.Y != 0 || point.Name != "" || point.Note != "" || point.ChapterID != nil {
					return fmt.Errorf("Ссылка на точку не должна содержать собственные координаты или описание")
				}
				references = append(references, point)
			} else {
				if point.Control && (point.Name != "" || point.Note != "" || point.ChapterID != nil) {
					return fmt.Errorf("Узел изгиба не может иметь описание или главу")
				}
				definitions[point.ID] = point
			}
			ids[point.ID] = true
			total++
		}
	}
	for _, reference := range references {
		point, exists := definitions[reference.RefID]
		if !exists || point.Control {
			return fmt.Errorf("Ссылка должна указывать на существующую обычную точку этой карты")
		}
	}
	if total > 1000 {
		return fmt.Errorf("На карте допускается до 1000 точек")
	}
	return nil
}

func coordinate(v float64) bool { return !math.IsNaN(v) && !math.IsInf(v, 0) && v >= 0 && v <= 1 }

// Detached chapters and former participants no longer appear as active links.
func PruneReferences(routes []Route, players, chapters map[int64]bool) {
	for i := range routes {
		kept := []int64{}
		for _, id := range routes[i].PlayerIDs {
			if players[id] {
				kept = append(kept, id)
			}
		}
		routes[i].PlayerIDs = kept
		if routes[i].Points == nil {
			routes[i].Points = []Point{}
		}
		for j := range routes[i].Points {
			p := &routes[i].Points[j]
			if p.ChapterID != nil && !chapters[*p.ChapterID] {
				p.ChapterID = nil
			}
		}
	}
}
