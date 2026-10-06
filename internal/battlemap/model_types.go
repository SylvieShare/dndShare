package battlemap

func ValidTileType(value string) bool {
	switch value {
	case "floor", "wall-straight", "wall-angle", "wall-tee", "wall-cross", "wall-corner", "wall-custom", "stairs", "frame", "prop":
		return true
	}
	return false
}
