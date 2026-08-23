package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

// SessionAdventureDocument is the portable, id-free representation accepted by
// the MCP adventure importer. Keys are local to their entity type and are
// resolved to database ids inside one transaction.
type SessionAdventureDocument struct {
	Name              string                     `json:"name"`
	Description       *string                    `json:"description,omitempty"`
	SystemID          *int64                     `json:"systemId,omitempty"`
	CurrentChapterKey string                     `json:"currentChapterKey,omitempty"`
	Arcs              []SessionAdventureArc      `json:"arcs"`
	Locations         []SessionAdventureLocation `json:"locations,omitempty"`
	NPCs              []SessionAdventureNPC      `json:"npcs,omitempty"`
	Quests            []SessionAdventureQuest    `json:"quests,omitempty"`
	Materials         []SessionAdventureMaterial `json:"materials,omitempty"`
	Relations         []SessionAdventureRelation `json:"relations,omitempty"`
}

type SessionAdventureArc struct {
	Key         string                    `json:"key"`
	Name        string                    `json:"name"`
	Description *string                   `json:"description,omitempty"`
	Chapters    []SessionAdventureChapter `json:"chapters"`
	Edges       []SessionAdventureEdge    `json:"edges,omitempty"`
}

type SessionAdventureChapter struct {
	Key         string                  `json:"key"`
	Number      string                  `json:"number"`
	Name        string                  `json:"name"`
	Description *string                 `json:"description,omitempty"`
	Status      string                  `json:"status"`
	ImageKey    string                  `json:"imageKey"`
	PositionX   float64                 `json:"positionX"`
	PositionY   float64                 `json:"positionY"`
	Scenes      []SessionAdventureScene `json:"scenes,omitempty"`
	Edges       []SessionAdventureEdge  `json:"sceneEdges,omitempty"`
}

type SessionAdventureScene struct {
	Key       string                  `json:"key"`
	Name      string                  `json:"name"`
	Status    string                  `json:"status"`
	ImageKey  string                  `json:"imageKey"`
	PositionX float64                 `json:"positionX"`
	PositionY float64                 `json:"positionY"`
	Blocks    []SessionAdventureBlock `json:"blocks,omitempty"`
	Edges     []SessionAdventureEdge  `json:"blockEdges,omitempty"`
}

type SessionAdventureBlock struct {
	Key          string          `json:"key"`
	Type         string          `json:"type"`
	Title        string          `json:"title"`
	Data         json.RawMessage `json:"data,omitempty"`
	ReferenceKey string          `json:"referenceKey,omitempty"`
	MaterialKey  string          `json:"materialKey,omitempty"`
	PositionX    float64         `json:"positionX"`
	PositionY    float64         `json:"positionY"`
	Width        float64         `json:"width,omitempty"`
}

type SessionAdventureEdge struct {
	From          string  `json:"from"`
	To            string  `json:"to"`
	Label         *string `json:"label,omitempty"`
	Bidirectional bool    `json:"bidirectional,omitempty"`
}

type SessionAdventureLocation struct {
	Key         string  `json:"key"`
	ParentKey   string  `json:"parentKey,omitempty"`
	Name        string  `json:"name"`
	Kind        string  `json:"kind"`
	Description *string `json:"description,omitempty"`
	ImageKey    string  `json:"imageKey"`
}

type SessionAdventureNPC struct {
	Key         string  `json:"key"`
	Name        string  `json:"name"`
	Role        *string `json:"role,omitempty"`
	Description *string `json:"description,omitempty"`
	Color       string  `json:"color"`
	ImageKey    string  `json:"imageKey"`
}

type SessionAdventureQuest struct {
	Key          string  `json:"key"`
	Name         string  `json:"name"`
	Status       string  `json:"status"`
	Goal         *string `json:"goal,omitempty"`
	Condition    *string `json:"condition,omitempty"`
	Reward       *string `json:"reward,omitempty"`
	Consequences *string `json:"consequences,omitempty"`
	Notes        *string `json:"notes,omitempty"`
}

type SessionAdventureMaterial struct {
	Key       string  `json:"key"`
	Kind      string  `json:"kind"`
	Name      string  `json:"name"`
	Caption   *string `json:"caption,omitempty"`
	Content   string  `json:"content"`
	NoteStyle *string `json:"noteStyle,omitempty"`
}

// From and To use "type:key" references. Supported types are location, npc,
// quest and material.
type SessionAdventureRelation struct {
	From string  `json:"from"`
	To   string  `json:"to"`
	Note *string `json:"note,omitempty"`
}

type SessionAdventureImportResult struct {
	ID         int64  `json:"id"`
	UUID       string `json:"uuid"`
	Name       string `json:"name"`
	OwnerLogin string `json:"ownerLogin"`
	Arcs       int    `json:"arcs"`
	Chapters   int    `json:"chapters"`
	Scenes     int    `json:"scenes"`
	Blocks     int    `json:"blocks"`
	Locations  int    `json:"locations"`
	NPCs       int    `json:"npcs"`
	Quests     int    `json:"quests"`
	Materials  int    `json:"materials"`
}

func validateAdventureDocument(doc SessionAdventureDocument) error {
	if strings.TrimSpace(doc.Name) == "" || len([]rune(doc.Name)) > 255 {
		return errors.New("adventure name must contain 1..255 characters")
	}
	if len(doc.Arcs) == 0 || len(doc.Arcs) > 20 {
		return errors.New("adventure must contain 1..20 arcs")
	}
	if len(doc.Locations) > 200 || len(doc.NPCs) > 200 || len(doc.Quests) > 200 || len(doc.Materials) > 200 {
		return errors.New("adventure entity limit exceeded (200 per type)")
	}
	return nil
}

var adventureStatuses = map[string]bool{
	"none": true, "draft": true, "planned": true, "ready": true, "available": true,
	"in_progress": true, "paused": true, "completed": true, "failed": true,
	"skipped": true, "cancelled": true,
}

var adventureLocationKinds = map[string]bool{
	"region": true, "settlement": true, "district": true, "building": true,
	"room": true, "wilderness": true, "dungeon": true, "other": true,
}

var adventureQuestStatuses = map[string]bool{"planned": true, "active": true, "completed": true, "failed": true}

var adventureBlockTypes = map[string]bool{
	"text": true, "list": true, "combat": true, "reward": true, "image": true,
	"material": true, "location": true, "npc": true, "quest": true,
}

func adventurePutKey(target map[string]int64, key, kind string, id int64) error {
	key = strings.TrimSpace(key)
	if key == "" {
		return fmt.Errorf("%s key is required", kind)
	}
	if _, exists := target[key]; exists {
		return fmt.Errorf("duplicate %s key %q", kind, key)
	}
	target[key] = id
	return nil
}

func adventureImageID(ctx context.Context, tx pgx.Tx, cache map[string]int64, key, scope string) (int64, error) {
	cacheKey := scope + ":" + key
	if id, ok := cache[cacheKey]; ok {
		return id, nil
	}
	var id int64
	err := tx.QueryRow(ctx, `SELECT image_id FROM dndshare.session_image_catalog WHERE catalog_key = $1 AND scope = $2`, key, scope).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return 0, fmt.Errorf("unknown %s image key %q", scope, key)
	}
	if err != nil {
		return 0, err
	}
	cache[cacheKey] = id
	return id, nil
}

func adventureNullable(value *string, max int) *string {
	if value == nil {
		return nil
	}
	cleaned := strings.TrimSpace(*value)
	if cleaned == "" {
		return nil
	}
	runes := []rune(cleaned)
	if len(runes) > max {
		cleaned = string(runes[:max])
	}
	return &cleaned
}

// ImportSessionAdventure resolves all portable keys and creates the session,
// campaign graph and world catalogue atomically.
func (s *Store) ImportSessionAdventure(ctx context.Context, ownerLogin string, doc SessionAdventureDocument) (SessionAdventureImportResult, error) {
	if err := validateAdventureDocument(doc); err != nil {
		return SessionAdventureImportResult{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionAdventureImportResult{}, err
	}
	defer tx.Rollback(ctx)

	var ownerID int64
	var defaultSystemID *int64
	err = tx.QueryRow(ctx, `SELECT id FROM dndshare.users WHERE login = $1`, strings.TrimSpace(ownerLogin)).Scan(&ownerID)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionAdventureImportResult{}, fmt.Errorf("user %q not found", ownerLogin)
	}
	if err != nil {
		return SessionAdventureImportResult{}, err
	}
	if doc.SystemID == nil {
		var sourceID int64
		if scanErr := tx.QueryRow(ctx, `SELECT version.source_id FROM dndshare.users user_row JOIN dndshare.source_version version ON version.id = user_row.source_version_id WHERE user_row.id = $1`, ownerID).Scan(&sourceID); scanErr == nil {
			defaultSystemID = &sourceID
		} else if !errors.Is(scanErr, pgx.ErrNoRows) {
			return SessionAdventureImportResult{}, scanErr
		}
	}
	systemID := doc.SystemID
	if systemID == nil {
		systemID = defaultSystemID
	}

	result := SessionAdventureImportResult{Name: strings.TrimSpace(doc.Name), OwnerLogin: strings.TrimSpace(ownerLogin)}
	if err := tx.QueryRow(ctx, `
		INSERT INTO dndshare."session" (owner_user_id, name, description, system_id, invite_code)
		VALUES ($1, $2, $3, $4, $5) RETURNING id, uuid::text`,
		ownerID, result.Name, adventureNullable(doc.Description, 10000), systemID, generateInviteCode(),
	).Scan(&result.ID, &result.UUID); err != nil {
		return SessionAdventureImportResult{}, err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO dndshare.session_presentation_state (session_id) VALUES ($1)`, result.ID); err != nil {
		return SessionAdventureImportResult{}, err
	}

	images := map[string]int64{}
	arcIDs := map[string]int64{}
	chapterIDs := map[string]int64{}
	sceneIDs := map[string]int64{}
	blockIDs := map[string]int64{}
	locationIDs := map[string]int64{}
	npcIDs := map[string]int64{}
	questIDs := map[string]int64{}
	materialIDs := map[string]int64{}

	for index, location := range doc.Locations {
		if !adventureLocationKinds[location.Kind] {
			return SessionAdventureImportResult{}, fmt.Errorf("location %q has invalid kind %q", location.Key, location.Kind)
		}
		var parentID *int64
		if location.ParentKey != "" {
			id, ok := locationIDs[location.ParentKey]
			if !ok {
				return SessionAdventureImportResult{}, fmt.Errorf("location %q has unknown or later parent %q", location.Key, location.ParentKey)
			}
			parentID = &id
		}
		imageID, err := adventureImageID(ctx, tx, images, location.ImageKey, "story")
		if err != nil {
			return SessionAdventureImportResult{}, err
		}
		var id int64
		err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_location
			(session_id, parent_location_id, name, kind, description, image_id, sort_order)
			VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, result.ID, parentID, strings.TrimSpace(location.Name), location.Kind,
			adventureNullable(location.Description, 5000), imageID, index).Scan(&id)
		if err != nil {
			return SessionAdventureImportResult{}, fmt.Errorf("create location %q: %w", location.Key, err)
		}
		if err := adventurePutKey(locationIDs, location.Key, "location", id); err != nil {
			return SessionAdventureImportResult{}, err
		}
		result.Locations++
	}

	for index, npc := range doc.NPCs {
		imageID, err := adventureImageID(ctx, tx, images, npc.ImageKey, "npc")
		if err != nil {
			return SessionAdventureImportResult{}, err
		}
		color := npc.Color
		if color == "" {
			color = "#7c5cff"
		}
		var id int64
		err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_npc
			(session_id, name, role, description, color, image_id, image_focal_x, image_focal_y, sort_order)
			VALUES ($1,$2,$3,$4,$5,$6,0.5,0.5,$7) RETURNING id`, result.ID, strings.TrimSpace(npc.Name),
			adventureNullable(npc.Role, 160), adventureNullable(npc.Description, 5000), color, imageID, index).Scan(&id)
		if err != nil {
			return SessionAdventureImportResult{}, fmt.Errorf("create npc %q: %w", npc.Key, err)
		}
		if err := adventurePutKey(npcIDs, npc.Key, "npc", id); err != nil {
			return SessionAdventureImportResult{}, err
		}
		result.NPCs++
	}

	for index, quest := range doc.Quests {
		if !adventureQuestStatuses[quest.Status] {
			return SessionAdventureImportResult{}, fmt.Errorf("quest %q has invalid status %q", quest.Key, quest.Status)
		}
		var id int64
		err := tx.QueryRow(ctx, `INSERT INTO dndshare.session_quest
			(session_id,name,status,goal,condition_text,reward,consequences,notes,sort_order)
			VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, result.ID, strings.TrimSpace(quest.Name), quest.Status,
			adventureNullable(quest.Goal, 5000), adventureNullable(quest.Condition, 5000), adventureNullable(quest.Reward, 5000),
			adventureNullable(quest.Consequences, 5000), adventureNullable(quest.Notes, 5000), index).Scan(&id)
		if err != nil {
			return SessionAdventureImportResult{}, fmt.Errorf("create quest %q: %w", quest.Key, err)
		}
		if err := adventurePutKey(questIDs, quest.Key, "quest", id); err != nil {
			return SessionAdventureImportResult{}, err
		}
		result.Quests++
	}

	for _, material := range doc.Materials {
		if material.Kind != "text" && material.Kind != "note" {
			return SessionAdventureImportResult{}, fmt.Errorf("material %q: portable imports support text and note kinds", material.Key)
		}
		var noteStyle *string
		if material.Kind == "note" {
			noteStyle = material.NoteStyle
			if noteStyle == nil || (*noteStyle != "parchment" && *noteStyle != "letter" && *noteStyle != "dossier" && *noteStyle != "arcane") {
				return SessionAdventureImportResult{}, fmt.Errorf("material %q has invalid noteStyle", material.Key)
			}
		}
		if strings.TrimSpace(material.Content) == "" {
			return SessionAdventureImportResult{}, fmt.Errorf("material %q content is required", material.Key)
		}
		var id int64
		err := tx.QueryRow(ctx, `INSERT INTO dndshare.session_material
			(session_id,kind,name,caption,content,note_style,map_data)
			VALUES ($1,$2,$3,$4,$5,$6,NULL) RETURNING id`, result.ID, material.Kind, strings.TrimSpace(material.Name),
			adventureNullable(material.Caption, 5000), strings.TrimSpace(material.Content), noteStyle).Scan(&id)
		if err != nil {
			return SessionAdventureImportResult{}, fmt.Errorf("create material %q: %w", material.Key, err)
		}
		if err := adventurePutKey(materialIDs, material.Key, "material", id); err != nil {
			return SessionAdventureImportResult{}, err
		}
		result.Materials++
	}

	for arcIndex, arc := range doc.Arcs {
		arcChapterIDs := map[string]int64{}
		var arcID int64
		if err := tx.QueryRow(ctx, `INSERT INTO dndshare.session_arc (session_id,"order",name,description) VALUES ($1,$2,$3,$4) RETURNING id`,
			result.ID, arcIndex+1, strings.TrimSpace(arc.Name), adventureNullable(arc.Description, 5000)).Scan(&arcID); err != nil {
			return SessionAdventureImportResult{}, fmt.Errorf("create arc %q: %w", arc.Key, err)
		}
		if err := adventurePutKey(arcIDs, arc.Key, "arc", arcID); err != nil {
			return SessionAdventureImportResult{}, err
		}
		result.Arcs++
		for _, chapter := range arc.Chapters {
			if !adventureStatuses[chapter.Status] {
				return SessionAdventureImportResult{}, fmt.Errorf("chapter %q has invalid status %q", chapter.Key, chapter.Status)
			}
			chapterSceneIDs := map[string]int64{}
			imageID, err := adventureImageID(ctx, tx, images, chapter.ImageKey, "story")
			if err != nil {
				return SessionAdventureImportResult{}, err
			}
			var chapterID int64
			err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_chapter
				(session_id,arc_id,number,name,description,status,image_id,image_focal_x,image_focal_y,position_x,position_y)
				VALUES ($1,$2,$3,$4,$5,$6,$7,0.5,0.5,$8,$9) RETURNING id`, result.ID, arcID, strings.TrimSpace(chapter.Number),
				strings.TrimSpace(chapter.Name), adventureNullable(chapter.Description, 2000), chapter.Status, imageID, chapter.PositionX, chapter.PositionY).Scan(&chapterID)
			if err != nil {
				return SessionAdventureImportResult{}, fmt.Errorf("create chapter %q: %w", chapter.Key, err)
			}
			if err := adventurePutKey(chapterIDs, chapter.Key, "chapter", chapterID); err != nil {
				return SessionAdventureImportResult{}, err
			}
			arcChapterIDs[chapter.Key] = chapterID
			result.Chapters++
			for _, scene := range chapter.Scenes {
				if !adventureStatuses[scene.Status] {
					return SessionAdventureImportResult{}, fmt.Errorf("scene %q has invalid status %q", scene.Key, scene.Status)
				}
				sceneBlockIDs := map[string]int64{}
				imageID, err := adventureImageID(ctx, tx, images, scene.ImageKey, "story")
				if err != nil {
					return SessionAdventureImportResult{}, err
				}
				var sceneID int64
				err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_scene (chapter_id,name,status,image_id,position_x,position_y) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
					chapterID, strings.TrimSpace(scene.Name), scene.Status, imageID, scene.PositionX, scene.PositionY).Scan(&sceneID)
				if err != nil {
					return SessionAdventureImportResult{}, fmt.Errorf("create scene %q: %w", scene.Key, err)
				}
				if err := adventurePutKey(sceneIDs, scene.Key, "scene", sceneID); err != nil {
					return SessionAdventureImportResult{}, err
				}
				chapterSceneIDs[scene.Key] = sceneID
				result.Scenes++
				for _, block := range scene.Blocks {
					if !adventureBlockTypes[block.Type] {
						return SessionAdventureImportResult{}, fmt.Errorf("block %q has invalid type %q", block.Key, block.Type)
					}
					data := block.Data
					var materialID *int64
					if block.ReferenceKey != "" {
						var id int64
						var ok bool
						switch block.Type {
						case "location":
							id, ok = locationIDs[block.ReferenceKey]
						case "npc":
							id, ok = npcIDs[block.ReferenceKey]
						case "quest":
							id, ok = questIDs[block.ReferenceKey]
						default:
							return SessionAdventureImportResult{}, fmt.Errorf("block %q cannot use referenceKey", block.Key)
						}
						if !ok {
							return SessionAdventureImportResult{}, fmt.Errorf("block %q has unknown %s reference %q", block.Key, block.Type, block.ReferenceKey)
						}
						data, _ = json.Marshal(map[string]int64{"referenceId": id})
					}
					if block.MaterialKey != "" {
						if block.Type != "material" && block.Type != "image" {
							return SessionAdventureImportResult{}, fmt.Errorf("block %q cannot use materialKey", block.Key)
						}
						id, ok := materialIDs[block.MaterialKey]
						if !ok {
							return SessionAdventureImportResult{}, fmt.Errorf("block %q has unknown material %q", block.Key, block.MaterialKey)
						}
						materialID = &id
					}
					if len(data) > 0 && !json.Valid(data) {
						return SessionAdventureImportResult{}, fmt.Errorf("block %q contains invalid JSON data", block.Key)
					}
					width := block.Width
					if width == 0 {
						width = 320
					}
					if width < 220 || width > 640 {
						return SessionAdventureImportResult{}, fmt.Errorf("block %q width must be 220..640", block.Key)
					}
					var blockID int64
					err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_scene_item
						(scene_id,type,title,data,material_id,position_x,position_y,width)
						VALUES ($1,$2,$3,CAST($4 AS jsonb),$5,$6,$7,$8) RETURNING id`, sceneID, block.Type, strings.TrimSpace(block.Title),
						func() any {
							if len(data) == 0 {
								return nil
							}
							return string(data)
						}(), materialID, block.PositionX, block.PositionY, width).Scan(&blockID)
					if err != nil {
						return SessionAdventureImportResult{}, fmt.Errorf("create block %q: %w", block.Key, err)
					}
					if err := adventurePutKey(blockIDs, block.Key, "block", blockID); err != nil {
						return SessionAdventureImportResult{}, err
					}
					sceneBlockIDs[block.Key] = blockID
					result.Blocks++
				}
				for _, edge := range scene.Edges {
					from, fromOK := sceneBlockIDs[edge.From]
					to, toOK := sceneBlockIDs[edge.To]
					if !fromOK || !toOK {
						return SessionAdventureImportResult{}, fmt.Errorf("scene %q block edge references unknown keys %q -> %q", scene.Key, edge.From, edge.To)
					}
					if _, err := tx.Exec(ctx, `INSERT INTO dndshare.session_scene_item_edge (scene_id,from_item_id,to_item_id,label,bidirectional) VALUES ($1,$2,$3,$4,$5)`,
						sceneID, from, to, adventureNullable(edge.Label, 240), edge.Bidirectional); err != nil {
						return SessionAdventureImportResult{}, err
					}
				}
			}
			for _, edge := range chapter.Edges {
				from, fromOK := chapterSceneIDs[edge.From]
				to, toOK := chapterSceneIDs[edge.To]
				if !fromOK || !toOK {
					return SessionAdventureImportResult{}, fmt.Errorf("chapter %q scene edge references unknown keys %q -> %q", chapter.Key, edge.From, edge.To)
				}
				if _, err := tx.Exec(ctx, `INSERT INTO dndshare.session_scene_edge (chapter_id,from_scene_id,to_scene_id,label,bidirectional) VALUES ($1,$2,$3,$4,$5)`,
					chapterID, from, to, adventureNullable(edge.Label, 240), edge.Bidirectional); err != nil {
					return SessionAdventureImportResult{}, err
				}
			}
		}
		for _, edge := range arc.Edges {
			from, fromOK := arcChapterIDs[edge.From]
			to, toOK := arcChapterIDs[edge.To]
			if !fromOK || !toOK {
				return SessionAdventureImportResult{}, fmt.Errorf("arc %q chapter edge references unknown keys %q -> %q", arc.Key, edge.From, edge.To)
			}
			if _, err := tx.Exec(ctx, `INSERT INTO dndshare.session_chapter_edge (arc_id,from_chapter_id,to_chapter_id,label,bidirectional) VALUES ($1,$2,$3,$4,$5)`,
				arcID, from, to, adventureNullable(edge.Label, 240), edge.Bidirectional); err != nil {
				return SessionAdventureImportResult{}, err
			}
		}
	}

	entityIDs := map[string]map[string]int64{"location": locationIDs, "npc": npcIDs, "quest": questIDs, "material": materialIDs}
	resolveEntity := func(ref string) (string, int64, error) {
		parts := strings.SplitN(ref, ":", 2)
		if len(parts) != 2 || entityIDs[parts[0]] == nil {
			return "", 0, fmt.Errorf("invalid entity reference %q", ref)
		}
		id, ok := entityIDs[parts[0]][parts[1]]
		if !ok {
			return "", 0, fmt.Errorf("unknown entity reference %q", ref)
		}
		return parts[0], id, nil
	}
	for _, relation := range doc.Relations {
		leftType, leftID, err := resolveEntity(relation.From)
		if err != nil {
			return SessionAdventureImportResult{}, err
		}
		rightType, rightID, err := resolveEntity(relation.To)
		if err != nil {
			return SessionAdventureImportResult{}, err
		}
		if leftType > rightType || (leftType == rightType && leftID > rightID) {
			leftType, rightType, leftID, rightID = rightType, leftType, rightID, leftID
		}
		if leftType == rightType && leftID == rightID {
			return SessionAdventureImportResult{}, fmt.Errorf("relation %q -> %q is self-referential", relation.From, relation.To)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO dndshare.session_entity_relation (session_id,left_type,left_id,right_type,right_id,note) VALUES ($1,$2,$3,$4,$5,$6)`,
			result.ID, leftType, leftID, rightType, rightID, adventureNullable(relation.Note, 500)); err != nil {
			return SessionAdventureImportResult{}, fmt.Errorf("create relation %q -> %q: %w", relation.From, relation.To, err)
		}
	}

	if doc.CurrentChapterKey != "" {
		chapterID, ok := chapterIDs[doc.CurrentChapterKey]
		if !ok {
			return SessionAdventureImportResult{}, fmt.Errorf("unknown current chapter key %q", doc.CurrentChapterKey)
		}
		if _, err := tx.Exec(ctx, `UPDATE dndshare."session" SET current_chapter_id = $2, changed_at = now() WHERE id = $1`, result.ID, chapterID); err != nil {
			return SessionAdventureImportResult{}, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return SessionAdventureImportResult{}, err
	}
	return result, nil
}

type SessionAdventureSceneExport struct {
	Scene      SessionScene           `json:"scene"`
	Edges      []SessionSceneEdge     `json:"edges"`
	Blocks     []SessionSceneItem     `json:"blocks"`
	BlockEdges []SessionSceneItemEdge `json:"blockEdges"`
}

type SessionAdventureExport struct {
	Session   GameSession                   `json:"session"`
	Graph     SessionChapterGraph           `json:"graph"`
	World     SessionWorld                  `json:"world"`
	Materials []SessionMaterial             `json:"materials"`
	Scenes    []SessionAdventureSceneExport `json:"scenes"`
}

// GetSessionAdventure returns the complete authored projection needed to
// verify an MCP import without exposing participants or character sheets.
func (s *Store) GetSessionAdventure(ctx context.Context, ownerLogin, uuid string) (SessionAdventureExport, error) {
	owner, err := s.FindUserByLogin(ctx, strings.TrimSpace(ownerLogin))
	if err != nil {
		return SessionAdventureExport{}, err
	}
	session, err := s.GetGameSessionByUUID(ctx, uuid)
	if err != nil {
		return SessionAdventureExport{}, err
	}
	if session.OwnerUserID != owner.ID {
		return SessionAdventureExport{}, ErrNotFound
	}
	graph, err := s.GetChapterGraph(ctx, session.ID)
	if err != nil {
		return SessionAdventureExport{}, err
	}
	world, err := s.GetSessionWorld(ctx, session.ID)
	if err != nil {
		return SessionAdventureExport{}, err
	}
	materials, err := s.ListSessionMaterials(ctx, session.ID)
	if err != nil {
		return SessionAdventureExport{}, err
	}
	result := SessionAdventureExport{Session: session, Graph: graph, World: world, Materials: materials, Scenes: []SessionAdventureSceneExport{}}
	for _, chapter := range graph.Chapters {
		scenes, err := s.GetScenesByChapter(ctx, chapter.ID)
		if err != nil {
			return SessionAdventureExport{}, err
		}
		sceneEdges, err := s.GetSceneEdgesByChapter(ctx, chapter.ID)
		if err != nil {
			return SessionAdventureExport{}, err
		}
		byScene := make(map[int64][]SessionSceneEdge)
		for _, edge := range sceneEdges {
			byScene[edge.FromSceneID] = append(byScene[edge.FromSceneID], edge)
		}
		for _, scene := range scenes {
			blocks, err := s.GetSceneItems(ctx, scene.ID)
			if err != nil {
				return SessionAdventureExport{}, err
			}
			blockEdges, err := s.GetSceneItemEdges(ctx, scene.ID)
			if err != nil {
				return SessionAdventureExport{}, err
			}
			result.Scenes = append(result.Scenes, SessionAdventureSceneExport{Scene: scene, Edges: byScene[scene.ID], Blocks: blocks, BlockEdges: blockEdges})
		}
	}
	return result, nil
}
