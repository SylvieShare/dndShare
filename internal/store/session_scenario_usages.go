package store

import "context"

func (s *Store) fillSessionWorldScenarioUsages(ctx context.Context, sessionID int64, world *SessionWorld) error {
	locationIndex := make(map[int64]int, len(world.Locations))
	npcIndex := make(map[int64]int, len(world.NPCs))
	questIndex := make(map[int64]int, len(world.Quests))
	for index := range world.Locations {
		world.Locations[index].ScenarioUsages = []SessionScenarioUsage{}
		locationIndex[world.Locations[index].ID] = index
	}
	for index := range world.NPCs {
		world.NPCs[index].ScenarioUsages = []SessionScenarioUsage{}
		npcIndex[world.NPCs[index].ID] = index
	}
	for index := range world.Quests {
		world.Quests[index].ScenarioUsages = []SessionScenarioUsage{}
		questIndex[world.Quests[index].ID] = index
	}

	rows, err := s.pool.Query(ctx, `
		SELECT item.type, (item.data ->> 'referenceId')::bigint, item.scene_id, count(*)::int
		FROM dndshare.session_scene_item item
		JOIN dndshare.session_scene scene ON scene.id = item.scene_id
		JOIN dndshare.session_chapter chapter ON chapter.id = scene.chapter_id
		WHERE chapter.session_id = $1
		  AND item.type IN ('location', 'npc', 'quest')
		  AND item.data ->> 'referenceId' ~ '^[1-9][0-9]*$'
		GROUP BY item.type, item.data ->> 'referenceId', item.scene_id
		ORDER BY item.scene_id, item.type, (item.data ->> 'referenceId')::bigint`, sessionID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var entityType string
		var entityID int64
		var usage SessionScenarioUsage
		if err := rows.Scan(&entityType, &entityID, &usage.SceneID, &usage.BlockCount); err != nil {
			return err
		}
		switch entityType {
		case SessionEntityLocation:
			if index, ok := locationIndex[entityID]; ok {
				world.Locations[index].ScenarioUsages = append(world.Locations[index].ScenarioUsages, usage)
			}
		case SessionEntityNPC:
			if index, ok := npcIndex[entityID]; ok {
				world.NPCs[index].ScenarioUsages = append(world.NPCs[index].ScenarioUsages, usage)
			}
		case SessionEntityQuest:
			if index, ok := questIndex[entityID]; ok {
				world.Quests[index].ScenarioUsages = append(world.Quests[index].ScenarioUsages, usage)
			}
		}
	}
	return rows.Err()
}

func (s *Store) loadSessionMaterialScenarioUsages(ctx context.Context, sessionID int64, materials []SessionMaterial) error {
	if len(materials) == 0 {
		return nil
	}
	byID := make(map[int64]*SessionMaterial, len(materials))
	ids := make([]int64, 0, len(materials))
	for index := range materials {
		materials[index].ScenarioUsages = []SessionScenarioUsage{}
		byID[materials[index].ID] = &materials[index]
		ids = append(ids, materials[index].ID)
	}
	rows, err := s.pool.Query(ctx, `
		SELECT item.material_id, item.scene_id, count(*)::int
		FROM dndshare.session_scene_item item
		JOIN dndshare.session_scene scene ON scene.id = item.scene_id
		JOIN dndshare.session_chapter chapter ON chapter.id = scene.chapter_id
		WHERE chapter.session_id = $1 AND item.material_id = ANY($2::bigint[])
		GROUP BY item.material_id, item.scene_id
		ORDER BY item.scene_id, item.material_id`, sessionID, ids)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var materialID int64
		var usage SessionScenarioUsage
		if err := rows.Scan(&materialID, &usage.SceneID, &usage.BlockCount); err != nil {
			return err
		}
		if material := byID[materialID]; material != nil {
			material.ScenarioUsages = append(material.ScenarioUsages, usage)
		}
	}
	return rows.Err()
}
