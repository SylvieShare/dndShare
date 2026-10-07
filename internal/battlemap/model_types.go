package battlemap

import "regexp"

var modelGroupCode = regexp.MustCompile(`^[A-Z]{2,3}-[a-z0-9]+(?:-[a-z0-9]+)*$`)

func ValidModelGroupCode(value string) bool {
	return len(value) <= 160 && modelGroupCode.MatchString(value)
}

func ValidTileType(value string) bool {
	switch value {
	case "floor", "wall-straight", "wall-angle", "wall-tee", "wall-cross", "wall-end", "wall-corner", "wall-diagonal", "stairs", "frame", "bridge", "passage", "column", "object":
		return true
	}
	return false
}
