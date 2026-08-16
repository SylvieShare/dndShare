package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

var (
	ErrInvalidWorldReference = errors.New("invalid session world reference")
	ErrLocationHasChildren   = errors.New("session location has children")
)

type SessionLocation struct {
	ID               int64   `json:"id"`
	SessionID        int64   `json:"sessionId"`
	ParentLocationID *int64  `json:"parentLocationId,omitempty"`
	Name             string  `json:"name"`
	Kind             string  `json:"kind"`
	Description      *string `json:"description,omitempty"`
	ImagePresetKey   *string `json:"imagePresetKey,omitempty"`
	SortOrder        int     `json:"sortOrder"`
	SceneIDs         []int64 `json:"sceneIds"`
	NPCIDs           []int64 `json:"npcIds"`
}

type SessionNPC struct {
	ID             int64                    `json:"id"`
	SessionID      int64                    `json:"sessionId"`
	Name           string                   `json:"name"`
	RaceItemID     *int64                   `json:"raceItemId,omitempty"`
	RaceName       *string                  `json:"raceName,omitempty"`
	Role           *string                  `json:"role,omitempty"`
	Description    *string                  `json:"description,omitempty"`
	Color          string                   `json:"color"`
	ImagePresetKey *string                  `json:"imagePresetKey,omitempty"`
	CustomImageID  *int64                   `json:"customImageId,omitempty"`
	CustomImageURL *string                  `json:"customImageUrl,omitempty"`
	ImageFocalX    float64                  `json:"imageFocalX"`
	ImageFocalY    float64                  `json:"imageFocalY"`
	SortOrder      int                      `json:"sortOrder"`
	LocationLinks  []SessionNPCLocationLink `json:"locationLinks"`
	SceneLinks     []SessionNPCSceneLink    `json:"sceneLinks"`
	NPCLinks       []SessionNPCNPCLink      `json:"npcLinks"`
}

type SessionNPCLocationLink struct {
	LocationID int64   `json:"locationId"`
	Note       *string `json:"note,omitempty"`
}

type SessionNPCSceneLink struct {
	SceneID int64   `json:"sceneId"`
	Note    *string `json:"note,omitempty"`
}

type SessionNPCNPCLink struct {
	NPCID int64   `json:"npcId"`
	Note  *string `json:"note,omitempty"`
}

type SessionWorldScene struct {
	ID             int64   `json:"id"`
	ChapterID      int64   `json:"chapterId"`
	Name           string  `json:"name"`
	ImagePresetKey string  `json:"imagePresetKey"`
	ArcOrder       int     `json:"arcOrder"`
	ArcName        string  `json:"arcName"`
	ChapterNumber  string  `json:"chapterNumber"`
	ChapterName    string  `json:"chapterName"`
	LocationIDs    []int64 `json:"locationIds"`
	NPCIDs         []int64 `json:"npcIds"`
}

type SessionWorld struct {
	Locations []SessionLocation   `json:"locations"`
	NPCs      []SessionNPC        `json:"npcs"`
	Scenes    []SessionWorldScene `json:"scenes"`
}

type SessionLocationMutation struct {
	ParentLocationID *int64
	Name             string
	Kind             string
	Description      *string
	ImagePresetKey   *string
	SceneIDs         []int64
}

type SessionNPCMutation struct {
	Name           string
	RaceItemID     *int64
	Role           *string
	Description    *string
	Color          string
	ImagePresetKey *string
	CustomImageID  *int64
	ImageFocalX    float64
	ImageFocalY    float64
	LocationLinks  []SessionNPCLocationLink
	SceneLinks     []SessionNPCSceneLink
	NPCLinks       []SessionNPCNPCLink
}

func scanSessionLocation(row pgx.Row) (SessionLocation, error) {
	location := SessionLocation{SceneIDs: []int64{}, NPCIDs: []int64{}}
	err := row.Scan(
		&location.ID, &location.SessionID, &location.ParentLocationID,
		&location.Name, &location.Kind, &location.Description,
		&location.ImagePresetKey, &location.SortOrder,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionLocation{}, ErrNotFound
	}
	return location, err
}

func scanSessionNPC(row pgx.Row) (SessionNPC, error) {
	npc := SessionNPC{
		LocationLinks: []SessionNPCLocationLink{}, SceneLinks: []SessionNPCSceneLink{}, NPCLinks: []SessionNPCNPCLink{},
	}
	err := row.Scan(
		&npc.ID, &npc.SessionID, &npc.Name, &npc.RaceItemID,
		&npc.Role, &npc.Description, &npc.Color, &npc.SortOrder, &npc.RaceName,
		&npc.ImagePresetKey, &npc.CustomImageID, &npc.CustomImageURL, &npc.ImageFocalX, &npc.ImageFocalY,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionNPC{}, ErrNotFound
	}
	return npc, err
}

func (s *Store) GetSessionLocation(ctx context.Context, id int64) (SessionLocation, error) {
	return scanSessionLocation(s.pool.QueryRow(ctx, `
		SELECT id, session_id, parent_location_id, name, kind, description, image_preset_key, sort_order
		FROM dndshare.session_location WHERE id = $1`, id))
}

func (s *Store) GetSessionNPC(ctx context.Context, id int64) (SessionNPC, error) {
	return scanSessionNPC(s.pool.QueryRow(ctx, `
		SELECT npc.id, npc.session_id, npc.name, npc.race_item_id, npc.role,
		       npc.description, npc.color, npc.sort_order, race.name,
		       npc.image_preset_key, npc.custom_image_id, image.url, npc.image_focal_x, npc.image_focal_y
		FROM dndshare.session_npc npc
		LEFT JOIN dndshare.item race ON race.id = npc.race_item_id
		LEFT JOIN dndshare.storage_image image ON image.id = npc.custom_image_id AND image.deleted = false
		WHERE npc.id = $1`, id))
}

func (s *Store) GetSessionWorld(ctx context.Context, sessionID int64) (SessionWorld, error) {
	world := SessionWorld{
		Locations: []SessionLocation{},
		NPCs:      []SessionNPC{},
		Scenes:    []SessionWorldScene{},
	}

	locationRows, err := s.pool.Query(ctx, `
		SELECT id, session_id, parent_location_id, name, kind, description, image_preset_key, sort_order
		FROM dndshare.session_location
		WHERE session_id = $1
		ORDER BY parent_location_id NULLS FIRST, sort_order, id`, sessionID)
	if err != nil {
		return SessionWorld{}, err
	}
	for locationRows.Next() {
		location, scanErr := scanSessionLocation(locationRows)
		if scanErr != nil {
			locationRows.Close()
			return SessionWorld{}, scanErr
		}
		world.Locations = append(world.Locations, location)
	}
	if err := locationRows.Err(); err != nil {
		locationRows.Close()
		return SessionWorld{}, err
	}
	locationRows.Close()

	npcRows, err := s.pool.Query(ctx, `
		SELECT npc.id, npc.session_id, npc.name, npc.race_item_id, npc.role,
		       npc.description, npc.color, npc.sort_order, race.name,
		       npc.image_preset_key, npc.custom_image_id, image.url, npc.image_focal_x, npc.image_focal_y
		FROM dndshare.session_npc npc
		LEFT JOIN dndshare.item race ON race.id = npc.race_item_id
		LEFT JOIN dndshare.storage_image image ON image.id = npc.custom_image_id AND image.deleted = false
		WHERE npc.session_id = $1
		ORDER BY npc.sort_order, npc.id`, sessionID)
	if err != nil {
		return SessionWorld{}, err
	}
	for npcRows.Next() {
		npc, scanErr := scanSessionNPC(npcRows)
		if scanErr != nil {
			npcRows.Close()
			return SessionWorld{}, scanErr
		}
		world.NPCs = append(world.NPCs, npc)
	}
	if err := npcRows.Err(); err != nil {
		npcRows.Close()
		return SessionWorld{}, err
	}
	npcRows.Close()

	sceneRows, err := s.pool.Query(ctx, `
		SELECT scene.id, scene.chapter_id, scene.name, scene.image_preset_key,
		       arc."order", arc.name, chapter.number, chapter.name
		FROM dndshare.session_scene scene
		JOIN dndshare.session_chapter chapter ON chapter.id = scene.chapter_id
		JOIN dndshare.session_arc arc ON arc.id = chapter.arc_id
		WHERE chapter.session_id = $1
		ORDER BY arc."order", chapter.id, scene.id`, sessionID)
	if err != nil {
		return SessionWorld{}, err
	}
	for sceneRows.Next() {
		scene := SessionWorldScene{LocationIDs: []int64{}, NPCIDs: []int64{}}
		if err := sceneRows.Scan(
			&scene.ID, &scene.ChapterID, &scene.Name, &scene.ImagePresetKey,
			&scene.ArcOrder, &scene.ArcName, &scene.ChapterNumber, &scene.ChapterName,
		); err != nil {
			sceneRows.Close()
			return SessionWorld{}, err
		}
		world.Scenes = append(world.Scenes, scene)
	}
	if err := sceneRows.Err(); err != nil {
		sceneRows.Close()
		return SessionWorld{}, err
	}
	sceneRows.Close()

	if err := s.fillSessionWorldLinks(ctx, sessionID, &world); err != nil {
		return SessionWorld{}, err
	}
	return world, nil
}

func (s *Store) fillSessionWorldLinks(ctx context.Context, sessionID int64, world *SessionWorld) error {
	locationIndex := make(map[int64]int, len(world.Locations))
	npcIndex := make(map[int64]int, len(world.NPCs))
	sceneIndex := make(map[int64]int, len(world.Scenes))
	for index, location := range world.Locations {
		locationIndex[location.ID] = index
	}
	for index, npc := range world.NPCs {
		npcIndex[npc.ID] = index
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
		SELECT link.npc_id, link.location_id, link.note
		FROM dndshare.session_npc_location link
		JOIN dndshare.session_npc npc ON npc.id = link.npc_id
		WHERE npc.session_id = $1`, sessionID)
	if err != nil {
		return err
	}
	for rows.Next() {
		var npcID, locationID int64
		var note *string
		if err := rows.Scan(&npcID, &locationID, &note); err != nil {
			rows.Close()
			return err
		}
		if index, ok := npcIndex[npcID]; ok {
			world.NPCs[index].LocationLinks = append(world.NPCs[index].LocationLinks, SessionNPCLocationLink{LocationID: locationID, Note: note})
		}
		if index, ok := locationIndex[locationID]; ok {
			world.Locations[index].NPCIDs = append(world.Locations[index].NPCIDs, npcID)
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
		SELECT relation.left_npc_id, relation.right_npc_id, relation.note
		FROM dndshare.session_npc_relation relation
		JOIN dndshare.session_npc npc ON npc.id = relation.left_npc_id
		WHERE npc.session_id = $1`, sessionID)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var leftID, rightID int64
		var note *string
		if err := rows.Scan(&leftID, &rightID, &note); err != nil {
			return err
		}
		if index, ok := npcIndex[leftID]; ok {
			world.NPCs[index].NPCLinks = append(world.NPCs[index].NPCLinks, SessionNPCNPCLink{NPCID: rightID, Note: note})
		}
		if index, ok := npcIndex[rightID]; ok {
			world.NPCs[index].NPCLinks = append(world.NPCs[index].NPCLinks, SessionNPCNPCLink{NPCID: leftID, Note: note})
		}
	}
	return rows.Err()
}
