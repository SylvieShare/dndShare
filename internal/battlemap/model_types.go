package battlemap

func ValidTileType(value string) bool {
	switch value {
	case "floor", "wall-straight", "wall-angle", "wall-tee", "wall-cross", "wall-end", "wall-corner", "wall-diagonal", "stairs", "frame", "prop":
		return true
	}
	return false
}
