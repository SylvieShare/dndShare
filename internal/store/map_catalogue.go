package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

var ErrMapAction = errors.New("action unavailable for this map")

type MapCatalogueEntry struct {
	BattleMap
	Rating      float64 `json:"rating"`
	RatingCount int     `json:"ratingCount"`
	MyRating    int     `json:"myRating"`
}
type MapSummary struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	Width            float64    `json:"width"`
	Height           float64    `json:"height"`
	TileCount        int        `json:"tileCount"`
	ObjectCount      int        `json:"objectCount"`
	Tags             []string   `json:"tags"`
	Revision         int64      `json:"revision"`
	ChangedAt        time.Time  `json:"changedAt"`
	PublishedAt      *time.Time `json:"publishedAt"`
	Owned            bool       `json:"owned"`
	Subscribed       bool       `json:"subscribed"`
	Author           string     `json:"author"`
	Rating           float64    `json:"rating"`
	RatingCount      int        `json:"ratingCount"`
	MyRating         int        `json:"myRating"`
	PreviewURL       string     `json:"previewUrl,omitempty"`
	PreviewSignature string     `json:"previewSignature,omitempty"`
	PreviewStale     bool       `json:"previewStale,omitempty"`
}

func (m MapCatalogueEntry) Summary() MapSummary {
	tags := m.Document.Tags
	if tags == nil {
		tags = []string{}
	}
	return MapSummary{
		ID:               m.ID,
		Name:             m.Name,
		Width:            m.Document.Width,
		Height:           m.Document.Height,
		TileCount:        len(m.Document.Tiles),
		ObjectCount:      len(m.Document.Objects),
		Tags:             tags,
		Revision:         m.Revision,
		ChangedAt:        m.ChangedAt,
		PublishedAt:      m.PublishedAt,
		Owned:            m.Owned,
		Subscribed:       m.Subscribed,
		Author:           m.Author,
		Rating:           m.Rating,
		RatingCount:      m.RatingCount,
		MyRating:         m.MyRating,
		PreviewURL:       m.PreviewURL,
		PreviewSignature: m.PreviewSignature,
		PreviewStale:     m.PreviewStale,
	}
}

const mapCatalogueColumns = `m.id::text,m.name,m.document,m.revision,m.changed_at,m.published_at,m.owner_user_id,u.login,m.owner_user_id=$1,
EXISTS(SELECT 1 FROM dndshare.map_subscription s WHERE s.map_id=m.id AND s.user_id=$1),
COALESCE((SELECT avg(r.rating)::float8 FROM dndshare.map_rating r WHERE r.map_id=m.id),0),
(SELECT count(*) FROM dndshare.map_rating r WHERE r.map_id=m.id),
COALESCE((SELECT r.rating FROM dndshare.map_rating r WHERE r.map_id=m.id AND r.user_id=$1),0)`

func scanCatalogueMap(row pgx.Row) (MapCatalogueEntry, error) {
	var m MapCatalogueEntry
	var raw []byte
	err := row.Scan(&m.ID, &m.Name, &raw, &m.Revision, &m.ChangedAt, &m.PublishedAt, &m.OwnerUserID, &m.Author, &m.Owned, &m.Subscribed, &m.Rating, &m.RatingCount, &m.MyRating)
	if errors.Is(err, pgx.ErrNoRows) {
		return m, ErrNotFound
	}
	if err == nil {
		err = json.Unmarshal(raw, &m.Document)
	}
	return m, err
}
func (s *Store) ListMapCatalogue(ctx context.Context, user int64, scope string) ([]MapCatalogueEntry, error) {
	conditions := map[string]string{"own": "m.owner_user_id=$1", "subscriptions": "m.published_at IS NOT NULL AND EXISTS(SELECT 1 FROM dndshare.map_subscription s WHERE s.map_id=m.id AND s.user_id=$1)", "catalogue": "m.published_at IS NOT NULL"}
	where, ok := conditions[scope]
	if !ok {
		return nil, ErrMapAction
	}
	rows, err := s.pool.Query(ctx, `SELECT `+mapCatalogueColumns+` FROM dndshare.battle_map m JOIN dndshare.users u ON u.id=m.owner_user_id WHERE `+where+` ORDER BY COALESCE(m.published_at,m.changed_at) DESC,m.id`, user)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []MapCatalogueEntry{}
	for rows.Next() {
		m, err := scanCatalogueMap(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, m)
	}
	return result, rows.Err()
}
func (s *Store) GetReadableBattleMap(ctx context.Context, user int64, id string) (MapCatalogueEntry, error) {
	return scanCatalogueMap(s.pool.QueryRow(ctx, `SELECT `+mapCatalogueColumns+` FROM dndshare.battle_map m JOIN dndshare.users u ON u.id=m.owner_user_id WHERE m.id=$2::uuid AND (m.owner_user_id=$1 OR m.published_at IS NOT NULL)`, user, id))
}
func (s *Store) GetUsableBattleMap(ctx context.Context, user int64, id string) (BattleMap, error) {
	m, err := s.GetReadableBattleMap(ctx, user, id)
	if err != nil {
		return m.BattleMap, err
	}
	if !m.Owned && !m.Subscribed {
		return m.BattleMap, ErrMapSubscriptionRequired
	}
	return m.BattleMap, nil
}
func (s *Store) PublishBattleMap(ctx context.Context, user int64, id string, revision int64) (BattleMap, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return BattleMap{}, err
	}
	defer tx.Rollback(ctx)
	m, err := scanBattleMap(tx.QueryRow(ctx, `SELECT id::text,name,document,revision,changed_at,published_at,owner_user_id FROM dndshare.battle_map WHERE id=$1::uuid AND owner_user_id=$2 FOR UPDATE`, id, user))
	if err != nil {
		return m, err
	}
	m.Owned = true
	if m.PublishedAt != nil {
		return m, nil
	}
	if m.Revision != revision {
		return m, ErrMapConflict
	}
	m, err = scanBattleMap(tx.QueryRow(ctx, `UPDATE dndshare.battle_map SET published_at=now(),changed_at=now(),revision=revision+1 WHERE id=$1::uuid RETURNING id::text,name,document,revision,changed_at,published_at,owner_user_id`, id))
	if err != nil {
		return m, err
	}
	m.Owned = true
	return m, tx.Commit(ctx)
}
func (s *Store) SubscribeMap(ctx context.Context, user int64, id string, subscribe bool) error {
	m, err := s.GetReadableBattleMap(ctx, user, id)
	if err != nil {
		return err
	}
	if m.PublishedAt == nil || m.Owned {
		return ErrMapAction
	}
	if !subscribe {
		_, err = s.pool.Exec(ctx, `DELETE FROM dndshare.map_subscription WHERE map_id=$1::uuid AND user_id=$2`, id, user)
		return err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO dndshare.map_subscription(map_id,user_id) VALUES($1::uuid,$2) ON CONFLICT DO NOTHING`, id, user)
	return err
}
func (s *Store) RateMap(ctx context.Context, user int64, id string, rating int) error {
	if rating < 0 || rating > 5 {
		return ErrMapAction
	}
	m, err := s.GetReadableBattleMap(ctx, user, id)
	if err != nil {
		return err
	}
	if m.PublishedAt == nil || m.Owned {
		return ErrMapAction
	}
	if rating == 0 {
		_, err = s.pool.Exec(ctx, `DELETE FROM dndshare.map_rating WHERE map_id=$1::uuid AND user_id=$2`, id, user)
		return err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO dndshare.map_rating(map_id,user_id,rating) VALUES($1::uuid,$2,$3) ON CONFLICT(map_id,user_id) DO UPDATE SET rating=EXCLUDED.rating,changed_at=now()`, id, user, rating)
	return err
}
