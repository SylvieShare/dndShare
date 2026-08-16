package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// MusicTrack — строка dndshare.music_track с подтянутыми albumIds/tags (порт model.MusicTrack).
type MusicTrack struct {
	ID          int64      `json:"id"`
	UUID        string     `json:"uuid"`
	OwnerUserID int64      `json:"ownerUserId,omitempty"`
	IsSystem    bool       `json:"isSystem"`
	Name        string     `json:"name"`
	FileKey     string     `json:"fileKey"`
	FileName    string     `json:"fileName"`
	DurationSec *int       `json:"durationSec,omitempty"`
	FileSize    int64      `json:"fileSize"`
	MimeType    string     `json:"mimeType"`
	CreatedAt   time.Time  `json:"createdAt"`
	AlbumIds    []int64    `json:"albumIds"`
	Tags        []MusicTag `json:"tags"`
}

// MusicAlbum — строка dndshare.music_album с числом треков (порт model.MusicAlbum).
type MusicAlbum struct {
	ID          int64     `json:"id"`
	OwnerUserID int64     `json:"ownerUserId,omitempty"`
	IsSystem    bool      `json:"isSystem"`
	Name        string    `json:"name"`
	Color       *string   `json:"color,omitempty"`
	Author      *string   `json:"author,omitempty"`
	SourceURL   *string   `json:"sourceUrl,omitempty"`
	LicenseName *string   `json:"licenseName,omitempty"`
	LicenseURL  *string   `json:"licenseUrl,omitempty"`
	TrackCount  int       `json:"trackCount"`
	CreatedAt   time.Time `json:"createdAt"`
}

// MusicTag — строка dndshare.music_tag (порт model.MusicTag).
type MusicTag struct {
	ID          int64  `json:"id"`
	OwnerUserID int64  `json:"ownerUserId"`
	Name        string `json:"name"`
}

const musicTrackColumns = `id, uuid::text, COALESCE(owner_user_id, 0), is_system, name, file_key, file_name, duration_sec, file_size, mime_type, created_at`

func scanMusicTrack(row pgx.Row) (MusicTrack, error) {
	var t MusicTrack
	err := row.Scan(&t.ID, &t.UUID, &t.OwnerUserID, &t.IsSystem, &t.Name, &t.FileKey, &t.FileName, &t.DurationSec, &t.FileSize, &t.MimeType, &t.CreatedAt)
	return t, err
}

// ---- tracks ----

// GetMusicTracksForUser отдаёт личные треки пользователя и общие системные треки.
func (s *Store) GetMusicTracksForUser(ctx context.Context, ownerUserID int64) ([]MusicTrack, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+musicTrackColumns+` FROM dndshare.music_track
		 WHERE owner_user_id = $1 OR is_system = true
		 ORDER BY is_system DESC, lower(name), id`,
		ownerUserID,
	)
	if err != nil {
		return nil, err
	}
	tracks, err := collectMusicTracks(rows)
	if err != nil {
		return nil, err
	}
	return s.enrichMusicTracks(ctx, tracks, ownerUserID)
}

// GetMusicTrackByID отдаёт трек по id (ErrNotFound, если нет) с albumIds/tags.
func (s *Store) GetMusicTrackByID(ctx context.Context, id int64) (MusicTrack, error) {
	t, err := scanMusicTrack(s.pool.QueryRow(ctx,
		`SELECT `+musicTrackColumns+` FROM dndshare.music_track WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return MusicTrack{}, ErrNotFound
	}
	if err != nil {
		return MusicTrack{}, err
	}
	enriched, err := s.enrichMusicTracks(ctx, []MusicTrack{t})
	if err != nil {
		return MusicTrack{}, err
	}
	return enriched[0], nil
}

// GetMusicTrackByIDForUser отдаёт трек с альбомами и тегами, видимыми конкретному пользователю.
func (s *Store) GetMusicTrackByIDForUser(ctx context.Context, id, ownerUserID int64) (MusicTrack, error) {
	t, err := scanMusicTrack(s.pool.QueryRow(ctx,
		`SELECT `+musicTrackColumns+` FROM dndshare.music_track WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return MusicTrack{}, ErrNotFound
	}
	if err != nil {
		return MusicTrack{}, err
	}
	enriched, err := s.enrichMusicTracks(ctx, []MusicTrack{t}, ownerUserID)
	if err != nil {
		return MusicTrack{}, err
	}
	return enriched[0], nil
}

// CreateMusicTrack вставляет трек и возвращает его в полном виде.
func (s *Store) CreateMusicTrack(ctx context.Context, ownerUserID int64, name, fileKey, fileName string, durationSec *int, fileSize int64, mimeType string) (MusicTrack, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.music_track (owner_user_id, name, file_key, file_name, duration_sec, file_size, mime_type)
		 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
		ownerUserID, name, fileKey, fileName, durationSec, fileSize, mimeType,
	).Scan(&id)
	if err != nil {
		return MusicTrack{}, err
	}
	return s.GetMusicTrackByID(ctx, id)
}

// RenameMusicTrack меняет имя трека.
func (s *Store) RenameMusicTrack(ctx context.Context, id int64, name string) error {
	_, err := s.pool.Exec(ctx, `UPDATE dndshare.music_track SET name = $1 WHERE id = $2`, name, id)
	return err
}

// DeleteMusicTrack удаляет трек (ссылки в link-таблицах уходят каскадом).
func (s *Store) DeleteMusicTrack(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.music_track WHERE id = $1`, id)
	return err
}

// ---- albums ----

const musicAlbumSelect = `SELECT a.id, COALESCE(a.owner_user_id, 0), a.is_system, a.name, a.color,
	a.author, a.source_url, a.license_name, a.license_url,
	(SELECT COUNT(*) FROM dndshare.music_album_track at WHERE at.album_id = a.id) AS track_count,
	a.created_at
	FROM dndshare.music_album a`

func scanMusicAlbum(row pgx.Row) (MusicAlbum, error) {
	var a MusicAlbum
	err := row.Scan(
		&a.ID, &a.OwnerUserID, &a.IsSystem, &a.Name, &a.Color,
		&a.Author, &a.SourceURL, &a.LicenseName, &a.LicenseURL,
		&a.TrackCount, &a.CreatedAt,
	)
	return a, err
}

// GetMusicAlbumsForUser отдаёт личные альбомы пользователя и общие системные альбомы.
func (s *Store) GetMusicAlbumsForUser(ctx context.Context, ownerUserID int64) ([]MusicAlbum, error) {
	rows, err := s.pool.Query(ctx, musicAlbumSelect+`
		WHERE a.owner_user_id = $1 OR a.is_system = true
		ORDER BY a.is_system DESC, lower(a.name), a.id`, ownerUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []MusicAlbum{}
	for rows.Next() {
		a, err := scanMusicAlbum(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// GetMusicAlbumByID отдаёт альбом по id (ErrNotFound, если нет).
func (s *Store) GetMusicAlbumByID(ctx context.Context, id int64) (MusicAlbum, error) {
	a, err := scanMusicAlbum(s.pool.QueryRow(ctx, musicAlbumSelect+` WHERE a.id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return MusicAlbum{}, ErrNotFound
	}
	return a, err
}

// CreateMusicAlbum вставляет альбом и возвращает его в полном виде.
func (s *Store) CreateMusicAlbum(ctx context.Context, ownerUserID int64, name string, color *string) (MusicAlbum, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.music_album (owner_user_id, name, color) VALUES ($1, $2, $3) RETURNING id`,
		ownerUserID, name, color,
	).Scan(&id)
	if err != nil {
		return MusicAlbum{}, err
	}
	return s.GetMusicAlbumByID(ctx, id)
}

// UpdateMusicAlbum обновляет имя (если задано) и цвет (если colorChanged); no-op, если менять нечего.
func (s *Store) UpdateMusicAlbum(ctx context.Context, id int64, name *string, color *string, colorChanged bool) error {
	if name != nil && colorChanged {
		_, err := s.pool.Exec(ctx, `UPDATE dndshare.music_album SET name = $1, color = $2 WHERE id = $3`, *name, color, id)
		return err
	}
	if name != nil {
		_, err := s.pool.Exec(ctx, `UPDATE dndshare.music_album SET name = $1 WHERE id = $2`, *name, id)
		return err
	}
	if colorChanged {
		_, err := s.pool.Exec(ctx, `UPDATE dndshare.music_album SET color = $1 WHERE id = $2`, color, id)
		return err
	}
	return nil
}

// DeleteMusicAlbum удаляет альбом (link-строки уходят каскадом).
func (s *Store) DeleteMusicAlbum(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.music_album WHERE id = $1`, id)
	return err
}

// ---- album <-> track ----

// AddTrackToAlbum добавляет трек в конец альбома (idempotent).
func (s *Store) AddTrackToAlbum(ctx context.Context, albumID, trackID int64) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO dndshare.music_album_track (album_id, track_id, position)
		 VALUES ($1, $2, (SELECT COALESCE(MAX(position), 0) + 1 FROM dndshare.music_album_track WHERE album_id = $1))
		 ON CONFLICT (album_id, track_id) DO NOTHING`,
		albumID, trackID,
	)
	return err
}

// SetAlbumTrackOrder переставляет позиции треков внутри альбома в одной транзакции.
func (s *Store) SetAlbumTrackOrder(ctx context.Context, albumID int64, trackIDs []int64) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for idx, trackID := range trackIDs {
		if _, err := tx.Exec(ctx,
			`UPDATE dndshare.music_album_track SET position = $1 WHERE album_id = $2 AND track_id = $3`,
			idx+1, albumID, trackID,
		); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// RemoveTrackFromAlbum убирает трек из альбома.
func (s *Store) RemoveTrackFromAlbum(ctx context.Context, albumID, trackID int64) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.music_album_track WHERE album_id = $1 AND track_id = $2`, albumID, trackID)
	return err
}

// GetTracksInAlbum отдаёт треки альбома по порядку с доступными пользователю albumIds/tags.
func (s *Store) GetTracksInAlbum(ctx context.Context, albumID, ownerUserID int64) ([]MusicTrack, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+prefixColumns("t")+` FROM dndshare.music_track t
		 JOIN dndshare.music_album_track at ON at.track_id = t.id
		 WHERE at.album_id = $1
		 ORDER BY at.position, at.id`,
		albumID,
	)
	if err != nil {
		return nil, err
	}
	tracks, err := collectMusicTracks(rows)
	if err != nil {
		return nil, err
	}
	return s.enrichMusicTracks(ctx, tracks, ownerUserID)
}

// ---- tags ----

// GetMusicTagsByOwner отдаёт теги владельца.
func (s *Store) GetMusicTagsByOwner(ctx context.Context, ownerUserID int64) ([]MusicTag, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, owner_user_id, name FROM dndshare.music_tag WHERE owner_user_id = $1 ORDER BY lower(name), id`,
		ownerUserID,
	)
	if err != nil {
		return nil, err
	}
	return collectMusicTags(rows)
}

// FindMusicTagByName ищет тег владельца по имени без учёта регистра (ErrNotFound, если нет).
func (s *Store) FindMusicTagByName(ctx context.Context, ownerUserID int64, name string) (MusicTag, error) {
	var t MusicTag
	err := s.pool.QueryRow(ctx,
		`SELECT id, owner_user_id, name FROM dndshare.music_tag WHERE owner_user_id = $1 AND lower(name) = lower($2)`,
		ownerUserID, name,
	).Scan(&t.ID, &t.OwnerUserID, &t.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return MusicTag{}, ErrNotFound
	}
	return t, err
}

// CreateMusicTag вставляет новый тег.
func (s *Store) CreateMusicTag(ctx context.Context, ownerUserID int64, name string) (MusicTag, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.music_tag (owner_user_id, name) VALUES ($1, $2) RETURNING id`,
		ownerUserID, name,
	).Scan(&id)
	if err != nil {
		return MusicTag{}, err
	}
	return MusicTag{ID: id, OwnerUserID: ownerUserID, Name: name}, nil
}

// RenameMusicTag меняет имя тега.
func (s *Store) RenameMusicTag(ctx context.Context, id int64, name string) error {
	_, err := s.pool.Exec(ctx, `UPDATE dndshare.music_tag SET name = $1 WHERE id = $2`, name, id)
	return err
}

// DeleteMusicTag удаляет тег (link-строки уходят каскадом).
func (s *Store) DeleteMusicTag(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM dndshare.music_tag WHERE id = $1`, id)
	return err
}

// GetMusicTagByID отдаёт тег по id (ErrNotFound, если нет).
func (s *Store) GetMusicTagByID(ctx context.Context, id int64) (MusicTag, error) {
	var t MusicTag
	err := s.pool.QueryRow(ctx,
		`SELECT id, owner_user_id, name FROM dndshare.music_tag WHERE id = $1`, id,
	).Scan(&t.ID, &t.OwnerUserID, &t.Name)
	if errors.Is(err, pgx.ErrNoRows) {
		return MusicTag{}, ErrNotFound
	}
	return t, err
}

// AddTagToTrack привязывает тег к треку (idempotent).
func (s *Store) AddTagToTrack(ctx context.Context, trackID, tagID int64) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO dndshare.music_track_tag (track_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		trackID, tagID,
	)
	return err
}

// RemoveTagFromTrack убирает тег с трека.
func (s *Store) RemoveTagFromTrack(ctx context.Context, trackID, tagID int64) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.music_track_tag WHERE track_id = $1 AND tag_id = $2`, trackID, tagID)
	return err
}

// ---- helpers ----

func prefixColumns(alias string) string {
	return alias + ".id, " + alias + ".uuid::text, COALESCE(" + alias + ".owner_user_id, 0), " + alias + ".is_system, " + alias + ".name, " +
		alias + ".file_key, " + alias + ".file_name, " + alias + ".duration_sec, " + alias + ".file_size, " +
		alias + ".mime_type, " + alias + ".created_at"
}

func collectMusicTracks(rows pgx.Rows) ([]MusicTrack, error) {
	defer rows.Close()
	out := []MusicTrack{}
	for rows.Next() {
		t, err := scanMusicTrack(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func collectMusicTags(rows pgx.Rows) ([]MusicTag, error) {
	defer rows.Close()
	out := []MusicTag{}
	for rows.Next() {
		var t MusicTag
		if err := rows.Scan(&t.ID, &t.OwnerUserID, &t.Name); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
