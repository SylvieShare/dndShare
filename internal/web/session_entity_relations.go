package web

import "dndshare/internal/store"

func validEntityRelations(relations []store.SessionEntityRelation) bool {
	if len(relations) > 500 {
		return false
	}
	for _, relation := range relations {
		if relation.ID <= 0 || (relation.Type != store.SessionEntityLocation && relation.Type != store.SessionEntityNPC && relation.Type != store.SessionEntityMaterial && relation.Type != store.SessionEntityQuest) {
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
