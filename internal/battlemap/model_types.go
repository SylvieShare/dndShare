package battlemap

import (
	"regexp"
	"strings"
)

var modelGroupCode = regexp.MustCompile(`^[A-Z]{2,3}-[a-z0-9]+(?:-[a-z0-9]+)*$`)

func ValidModelCategory(value string) bool {
	switch value {
	case "floor", "wall", "water", "railway", "stairs", "frame", "bridge", "passage", "column", "object":
		return true
	}
	return false
}

func ValidModelGroupCode(value string) bool {
	return len(value) <= 160 && modelGroupCode.MatchString(value)
}

func ValidModelVariantCode(group, variant string) bool {
	return variant == "" || (ValidModelGroupCode(variant) && strings.SplitN(group, "-", 2)[0] == strings.SplitN(variant, "-", 2)[0])
}

func ValidTileType(value string) bool {
	switch value {
	case "floor", "wall-straight", "wall-angle", "wall-tee", "wall-cross", "wall-end", "wall-corner", "wall-diagonal", "stairs", "frame", "bridge", "passage", "column", "object":
		return true
	}
	return false
}
