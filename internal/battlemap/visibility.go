package battlemap

import "math"

func Visibility(d Document, s State, x, y float64) string {
	if !s.Fog {
		return "visible"
	}
	level := -1
	cx, cy := int(math.Floor(x-d.Grid.OffsetX)), int(math.Floor(y-d.Grid.OffsetY))
	cell := cy*int(math.Ceil(d.Width)) + cx
	validCell := cx >= 0 && cy >= 0 && cx < int(math.Ceil(d.Width)) && cy < int(math.Ceil(d.Height))
	for _, z := range d.Zones {
		inside := false
		for _, c := range z.Cells {
			if validCell && c == cell {
				inside = true
				break
			}
		}
		for _, r := range z.Rects {
			if x >= r.X && y >= r.Y && x < r.X+r.Width && y < r.Y+r.Height {
				inside = true
				break
			}
		}
		if inside {
			v := 0
			switch s.Zones[z.ID] {
			case "explored":
				v = 1
			case "visible":
				v = 2
			}
			if v > level {
				level = v
			}
		}
	}
	if level < 0 {
		return s.DefaultVisibility
	}
	return []string{"hidden", "explored", "visible"}[level]
}

// PublicState deliberately excludes hidden/physical tokens and internal links.
// The table display never receives creature statistics or master-only notes.
func PublicState(d Document, s State) State {
	result := s
	result.Tokens = []Token{}
	for _, t := range s.Tokens {
		if t.Hidden || t.Physical || Visibility(d, s, t.X, t.Y) != "visible" {
			continue
		}
		t.Ref = ""
		result.Tokens = append(result.Tokens, t)
	}
	return result
}
