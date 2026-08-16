package web

import "dndshare/internal/store"

func validEntityRelations(relations []store.SessionEntityRelation) bool {
	if len(relations) > 500 {
		return false
	}
	for _, relation := range relations {
		if relation.ID <= 0 || (relation.Type != "location" && relation.Type != "npc" && relation.Type != "material" && relation.Type != "quest") {
			return false
		}
	}
	return true
}

func cleanEntityRelations(relations []store.SessionEntityRelation) []store.SessionEntityRelation {
	for index := range relations {
		relations[index].Note = cleanText(relations[index].Note, 500)
	}
	return relations
}
