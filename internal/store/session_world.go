package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

var (
	ErrInvalidWorldReference = errors.New("invalid session world reference")
	ErrLocationHasChildren   = errors.New("session location has children")
	ErrWorldEntityInUse      = errors.New("session entity is used in a scenario")
)

type SessionLocation struct {
	ID               int64                   `json:"id"`
	SessionID        int64                   `json:"sessionId"`
	ParentLocationID *int64                  `json:"parentLocationId,omitempty"`
	Name             string                  `json:"name"`
	Kind             string                  `json:"kind"`
	Description      *string                 `json:"description,omitempty"`
	ImageID          int64                   `json:"imageId"`
	ImageURL         string                  `json:"imageUrl"`
	ImageCatalogKey  *string                 `json:"imageCatalogKey,omitempty"`
	SortOrder        int                     `json:"sortOrder"`
	Relations        []SessionEntityRelation `json:"relations"`
}

type SessionNPC struct {
	ID              int64                   `json:"id"`
	SessionID       int64                   `json:"sessionId"`
	Name            string                  `json:"name"`
	RaceItemID      *int64                  `json:"raceItemId,omitempty"`
	RaceName        *string                 `json:"raceName,omitempty"`
	Role            *string                 `json:"role,omitempty"`
	Description     *string                 `json:"description,omitempty"`
	Color           string                  `json:"color"`
	ImageID         int64                   `json:"imageId"`
	ImageURL        string                  `json:"imageUrl"`
	ImageCatalogKey *string                 `json:"imageCatalogKey,omitempty"`
	ImageFocalX     float64                 `json:"imageFocalX"`
	ImageFocalY     float64                 `json:"imageFocalY"`
	SortOrder       int                     `json:"sortOrder"`
	Relations       []SessionEntityRelation `json:"relations"`
}

type SessionEntityRelation struct {
	Type string  `json:"type"`
	ID   int64   `json:"id"`
	Note *string `json:"note,omitempty"`
}

type SessionQuest struct {
	ID           int64                   `json:"id"`
	SessionID    int64                   `json:"sessionId"`
	Name         string                  `json:"name"`
	Status       string                  `json:"status"`
	Goal         *string                 `json:"goal,omitempty"`
	Condition    *string                 `json:"condition,omitempty"`
	Reward       *string                 `json:"reward,omitempty"`
	Consequences *string                 `json:"consequences,omitempty"`
	Notes        *string                 `json:"notes,omitempty"`
	SortOrder    int                     `json:"sortOrder"`
	Relations    []SessionEntityRelation `json:"relations"`
}

type SessionWorldScene struct {
	ID              int64                   `json:"id"`
	ChapterID       int64                   `json:"chapterId"`
	Name            string                  `json:"name"`
	ImageID         int64                   `json:"imageId"`
	ImageURL        string                  `json:"imageUrl"`
	ImageCatalogKey *string                 `json:"imageCatalogKey,omitempty"`
	ArcOrder        int                     `json:"arcOrder"`
	ArcName         string                  `json:"arcName"`
	ChapterNumber   string                  `json:"chapterNumber"`
	ChapterName     string                  `json:"chapterName"`
	Relations       []SessionEntityRelation `json:"relations"`
}

type SessionWorld struct {
	Locations []SessionLocation   `json:"locations"`
	NPCs      []SessionNPC        `json:"npcs"`
	Quests    []SessionQuest      `json:"quests"`
	Scenes    []SessionWorldScene `json:"scenes"`
}

type SessionLocationMutation struct {
	ParentLocationID *int64
	Name             string
	Kind             string
	Description      *string
	ImageID          int64
	Relations        []SessionEntityRelation
}

type SessionNPCMutation struct {
	Name        string
	RaceItemID  *int64
	Role        *string
	Description *string
	Color       string
	ImageID     int64
	ImageFocalX float64
	ImageFocalY float64
	Relations   []SessionEntityRelation
}

type SessionQuestMutation struct {
	Name         string
	Status       string
	Goal         *string
	Condition    *string
	Reward       *string
	Consequences *string
	Notes        *string
	Relations    []SessionEntityRelation
}

func scanSessionLocation(row pgx.Row) (SessionLocation, error) {
	location := SessionLocation{Relations: []SessionEntityRelation{}}
	err := row.Scan(
		&location.ID, &location.SessionID, &location.ParentLocationID,
		&location.Name, &location.Kind, &location.Description,
		&location.ImageID, &location.ImageURL, &location.ImageCatalogKey, &location.SortOrder,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionLocation{}, ErrNotFound
	}
	return location, err
}

func scanSessionNPC(row pgx.Row) (SessionNPC, error) {
	npc := SessionNPC{Relations: []SessionEntityRelation{}}
	err := row.Scan(
		&npc.ID, &npc.SessionID, &npc.Name, &npc.RaceItemID,
		&npc.Role, &npc.Description, &npc.Color, &npc.SortOrder, &npc.RaceName,
		&npc.ImageID, &npc.ImageURL, &npc.ImageCatalogKey, &npc.ImageFocalX, &npc.ImageFocalY,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionNPC{}, ErrNotFound
	}
	return npc, err
}

func (s *Store) GetSessionLocation(ctx context.Context, id int64) (SessionLocation, error) {
	return scanSessionLocation(s.pool.QueryRow(ctx, `
		SELECT location.id, location.session_id, location.parent_location_id, location.name,
		       location.kind, location.description, location.image_id, image.url, catalog.catalog_key,
		       location.sort_order
		FROM dndshare.session_location location
		JOIN dndshare.storage_image image ON image.id = location.image_id AND image.deleted = false
		LEFT JOIN dndshare.session_image_catalog catalog ON catalog.image_id = location.image_id
		WHERE location.id = $1`, id))
}

func (s *Store) GetSessionNPC(ctx context.Context, id int64) (SessionNPC, error) {
	return scanSessionNPC(s.pool.QueryRow(ctx, `
		SELECT npc.id, npc.session_id, npc.name, npc.race_item_id, npc.role,
		       npc.description, npc.color, npc.sort_order, race.name,
		       npc.image_id, image.url, catalog.catalog_key, npc.image_focal_x, npc.image_focal_y
		FROM dndshare.session_npc npc
		LEFT JOIN dndshare.item race ON race.id = npc.race_item_id
		JOIN dndshare.storage_image image ON image.id = npc.image_id AND image.deleted = false
		LEFT JOIN dndshare.session_image_catalog catalog ON catalog.image_id = npc.image_id
		WHERE npc.id = $1`, id))
}

func (s *Store) GetSessionWorld(ctx context.Context, sessionID int64) (SessionWorld, error) {
	world := SessionWorld{
		Locations: []SessionLocation{},
		NPCs:      []SessionNPC{},
		Quests:    []SessionQuest{},
		Scenes:    []SessionWorldScene{},
	}

	locationRows, err := s.pool.Query(ctx, `
		SELECT location.id, location.session_id, location.parent_location_id, location.name,
		       location.kind, location.description, location.image_id, image.url, catalog.catalog_key,
		       location.sort_order
		FROM dndshare.session_location location
		JOIN dndshare.storage_image image ON image.id = location.image_id AND image.deleted = false
		LEFT JOIN dndshare.session_image_catalog catalog ON catalog.image_id = location.image_id
		WHERE location.session_id = $1
		ORDER BY location.parent_location_id NULLS FIRST, location.sort_order, location.id`, sessionID)
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
		       npc.image_id, image.url, catalog.catalog_key, npc.image_focal_x, npc.image_focal_y
		FROM dndshare.session_npc npc
		LEFT JOIN dndshare.item race ON race.id = npc.race_item_id
		JOIN dndshare.storage_image image ON image.id = npc.image_id AND image.deleted = false
		LEFT JOIN dndshare.session_image_catalog catalog ON catalog.image_id = npc.image_id
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

	questRows, err := s.pool.Query(ctx, `
		SELECT id, session_id, name, status, goal, condition_text, reward, consequences, notes, sort_order
		FROM dndshare.session_quest
		WHERE session_id = $1
		ORDER BY sort_order, id`, sessionID)
	if err != nil {
		return SessionWorld{}, err
	}
	for questRows.Next() {
		quest := SessionQuest{Relations: []SessionEntityRelation{}}
		if err := questRows.Scan(
			&quest.ID, &quest.SessionID, &quest.Name, &quest.Status,
			&quest.Goal, &quest.Condition, &quest.Reward, &quest.Consequences, &quest.Notes, &quest.SortOrder,
		); err != nil {
			questRows.Close()
			return SessionWorld{}, err
		}
		world.Quests = append(world.Quests, quest)
	}
	if err := questRows.Err(); err != nil {
		questRows.Close()
		return SessionWorld{}, err
	}
	questRows.Close()

	sceneRows, err := s.pool.Query(ctx, `
		SELECT scene.id, scene.chapter_id, scene.name, scene.image_id, image.url, catalog.catalog_key,
		       arc."order", arc.name, chapter.number, chapter.name
		FROM dndshare.session_scene scene
		JOIN dndshare.session_chapter chapter ON chapter.id = scene.chapter_id
		JOIN dndshare.session_arc arc ON arc.id = chapter.arc_id
		JOIN dndshare.storage_image image ON image.id = scene.image_id AND image.deleted = false
		LEFT JOIN dndshare.session_image_catalog catalog ON catalog.image_id = scene.image_id
		WHERE chapter.session_id = $1
		ORDER BY arc."order", chapter.id, scene.id`, sessionID)
	if err != nil {
		return SessionWorld{}, err
	}
	for sceneRows.Next() {
		scene := SessionWorldScene{Relations: []SessionEntityRelation{}}
		if err := sceneRows.Scan(
			&scene.ID, &scene.ChapterID, &scene.Name, &scene.ImageID, &scene.ImageURL, &scene.ImageCatalogKey,
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
