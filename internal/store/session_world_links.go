package store

import "context"

func (s *Store) fillSessionWorldLinks(ctx context.Context, sessionID int64, world *SessionWorld) error {
	locationIndex := make(map[int64]int, len(world.Locations))
	npcIndex := make(map[int64]int, len(world.NPCs))
	questIndex := make(map[int64]int, len(world.Quests))
	sceneIndex := make(map[int64]int, len(world.Scenes))
	for index, location := range world.Locations {
		locationIndex[location.ID] = index
	}
	for index, npc := range world.NPCs {
		npcIndex[npc.ID] = index
	}
	for index, quest := range world.Quests {
		questIndex[quest.ID] = index
	}
	for index, scene := range world.Scenes {
		sceneIndex[scene.ID] = index
	}

	rows, err := s.pool.Query(ctx, `
		SELECT link.scene_id, link.location_id
		FROM dndshare.session_scene_location link
		JOIN dndshare.session_location location ON location.id = link.location_id
		WHERE location.session_id = $1`, sessionID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var sceneID, locationID int64
		if err := rows.Scan(&sceneID, &locationID); err != nil {
			rows.Close()
			return err
		}
		if index, ok := locationIndex[locationID]; ok {
			world.Locations[index].SceneIDs = append(world.Locations[index].SceneIDs, sceneID)
		}
		if index, ok := sceneIndex[sceneID]; ok {
			world.Scenes[index].LocationIDs = append(world.Scenes[index].LocationIDs, locationID)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	rows, err = s.pool.Query(ctx, `
		SELECT link.npc_id, link.scene_id, link.note
		FROM dndshare.session_npc_scene link
		JOIN dndshare.session_npc npc ON npc.id = link.npc_id
		WHERE npc.session_id = $1`, sessionID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var npcID, sceneID int64
		var note *string
		if err := rows.Scan(&npcID, &sceneID, &note); err != nil {
			rows.Close()
			return err
		}
		if index, ok := npcIndex[npcID]; ok {
			world.NPCs[index].SceneLinks = append(world.NPCs[index].SceneLinks, SessionNPCSceneLink{SceneID: sceneID, Note: note})
		}
		if index, ok := sceneIndex[sceneID]; ok {
			world.Scenes[index].NPCIDs = append(world.Scenes[index].NPCIDs, npcID)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return err
	}
	rows.Close()

	rows, err = s.pool.Query(ctx, `
		SELECT left_type, left_id, right_type, right_id, note
		FROM dndshare.session_entity_relation
		WHERE session_id = $1
		ORDER BY left_type, left_id, right_type, right_id`, sessionID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var leftType, rightType string
		var leftID, rightID int64
		var note *string
		if err := rows.Scan(&leftType, &leftID, &rightType, &rightID, &note); err != nil {
			return err
		}
		appendSessionWorldRelation(world, locationIndex, npcIndex, questIndex, leftType, leftID, SessionEntityRelation{Type: rightType, ID: rightID, Note: note})
		appendSessionWorldRelation(world, locationIndex, npcIndex, questIndex, rightType, rightID, SessionEntityRelation{Type: leftType, ID: leftID, Note: note})
	}
	return rows.Err()
}

func appendSessionWorldRelation(world *SessionWorld, locationIndex, npcIndex, questIndex map[int64]int, entityType string, entityID int64, relation SessionEntityRelation) {
	switch entityType {
	case SessionEntityLocation:
		if index, ok := locationIndex[entityID]; ok {
			world.Locations[index].Relations = append(world.Locations[index].Relations, relation)
		}
	case SessionEntityNPC:
		if index, ok := npcIndex[entityID]; ok {
			world.NPCs[index].Relations = append(world.NPCs[index].Relations, relation)
		}
	case SessionEntityQuest:
		if index, ok := questIndex[entityID]; ok {
			world.Quests[index].Relations = append(world.Quests[index].Relations, relation)
		}
	}
}
