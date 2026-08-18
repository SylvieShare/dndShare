package store

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

// StorageImageRecord — строка dndshare.storage_image (порт StorageImageRepository.StorageImageRecord).
type StorageImageRecord struct {
	ID       int64
	UserID   *int64
	Key      *string
	URL      string
	Type     *string
	FileSize *int64
	FileName *string
	MimeType *string
}

// SaveStorageImage сохраняет объект и возвращает id (порт StorageImageRepository.saveObject).
func (s *Store) SaveStorageImage(ctx context.Context, userID int64, key, url, typ, fileName, mimeType string, fileSize int64) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.storage_image (user_id, "key", url, "type", file_name, mime_type, file_size)
		 VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), $7)
		 RETURNING id`,
		userID, key, url, typ, fileName, mimeType, fileSize,
	).Scan(&id)
	return id, err
}

// GetActiveUserStorageImage — активный объект пользователя (порт getActiveUserObject).
func (s *Store) GetActiveUserStorageImage(ctx context.Context, id, userID int64) (StorageImageRecord, error) {
	return s.scanStorageImage(ctx,
		`SELECT id, user_id, "key", url, "type", file_size, file_name, mime_type
		 FROM dndshare.storage_image
		 WHERE id = $1 AND user_id = $2 AND deleted = false`,
		id, userID,
	)
}

// GetActiveStorageImage — активный объект по id (порт getActiveObject).
func (s *Store) GetActiveStorageImage(ctx context.Context, id int64) (StorageImageRecord, error) {
	return s.scanStorageImage(ctx,
		`SELECT id, user_id, "key", url, "type", file_size, file_name, mime_type
		 FROM dndshare.storage_image
		 WHERE id = $1 AND deleted = false`,
		id,
	)
}

// GetActiveStorageImageByURL — активный объект по url и типу (порт getActiveObjectByUrl).
func (s *Store) GetActiveStorageImageByURL(ctx context.Context, url, typ string) (StorageImageRecord, error) {
	return s.scanStorageImage(ctx,
		`SELECT id, user_id, "key", url, "type", file_size, file_name, mime_type
		 FROM dndshare.storage_image
		 WHERE url = $1 AND "type" = $2 AND deleted = false`,
		url, typ,
	)
}

// MarkStorageImageDeletedIfUnreferenced marks an orphaned object as deleted
// and returns its S3 key. A nil key means the row stayed referenced or the
// image is an external URL with no S3 object.
func (s *Store) MarkStorageImageDeletedIfUnreferenced(ctx context.Context, id int64) (*string, error) {
	var key *string
	err := s.pool.QueryRow(ctx,
		`UPDATE dndshare.storage_image img
		    SET deleted = true
		  WHERE img.id = $1
		    AND img.deleted = false
		    AND NOT EXISTS (SELECT 1 FROM dndshare.item i WHERE i.icon_image_id = img.id)
		    AND NOT EXISTS (SELECT 1 FROM dndshare.item i WHERE i.cover_image_id = img.id)
		    AND NOT EXISTS (SELECT 1 FROM dndshare.session_image_catalog catalog WHERE catalog.image_id = img.id)
		    AND NOT EXISTS (SELECT 1 FROM dndshare.session_chapter chapter WHERE chapter.image_id = img.id)
		    AND NOT EXISTS (SELECT 1 FROM dndshare.session_scene scene WHERE scene.image_id = img.id)
		    AND NOT EXISTS (SELECT 1 FROM dndshare.session_material material WHERE material.asset_id = img.id)
		    AND NOT EXISTS (SELECT 1 FROM dndshare.session_location location WHERE location.image_id = img.id)
		    AND NOT EXISTS (SELECT 1 FROM dndshare.session_npc npc WHERE npc.image_id = img.id)
		  RETURNING img."key"`,
		id,
	).Scan(&key)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return key, nil
}

func (s *Store) scanStorageImage(ctx context.Context, query string, args ...any) (StorageImageRecord, error) {
	var rec StorageImageRecord
	err := s.pool.QueryRow(ctx, query, args...).Scan(&rec.ID, &rec.UserID, &rec.Key, &rec.URL, &rec.Type, &rec.FileSize, &rec.FileName, &rec.MimeType)
	if errors.Is(err, pgx.ErrNoRows) {
		return StorageImageRecord{}, ErrNotFound
	}
	return rec, err
}

type AccountStorageFile struct {
	Source    string    `json:"source"`
	ID        int64     `json:"id"`
	Kind      string    `json:"kind"`
	Name      string    `json:"name"`
	FileSize  *int64    `json:"fileSize,omitempty"`
	MimeType  string    `json:"mimeType,omitempty"`
	URL       *string   `json:"url,omitempty"`
	ObjectKey *string   `json:"-"`
	CreatedAt time.Time `json:"createdAt"`
}

const accountStorageFilesQuery = `
	SELECT source, id, kind, name, file_size, mime_type, url, object_key, created_at
	FROM (
		SELECT 'asset'::text AS source, image.id,
		       CASE WHEN image."type" = 'video' THEN 'video' ELSE 'image' END AS kind,
		       COALESCE(NULLIF(image.file_name, ''), CASE WHEN image."type" = 'video' THEN 'Видео' ELSE 'Изображение' END) AS name,
		       image.file_size, COALESCE(image.mime_type, '') AS mime_type, image.url, image."key" AS object_key, image.created_at
		FROM dndshare.storage_image image
		WHERE image.user_id = $1 AND image.deleted = false
		UNION ALL
		SELECT 'svg'::text, svg.id, 'image'::text,
		       COALESCE(NULLIF(svg.file_name, ''), 'SVG-изображение'), svg.file_size,
		       COALESCE(svg.mime_type, 'image/svg+xml'), NULL::varchar, NULL::varchar, svg.created_at
		FROM dndshare.svg_storage svg
		WHERE svg.user_id = $1
		UNION ALL
		SELECT 'music'::text, track.id, 'music'::text,
		       COALESCE(NULLIF(track.file_name, ''), track.name), track.file_size,
		       track.mime_type, NULL::varchar, track.file_key, track.created_at
		FROM dndshare.music_track track
		WHERE track.owner_user_id = $1 AND track.is_system = false
	) files
	ORDER BY created_at DESC, source, id DESC`

func (s *Store) ListAccountStorageFiles(ctx context.Context, userID int64) ([]AccountStorageFile, error) {
	rows, err := s.pool.Query(ctx, accountStorageFilesQuery, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	files := []AccountStorageFile{}
	for rows.Next() {
		var file AccountStorageFile
		if err := rows.Scan(&file.Source, &file.ID, &file.Kind, &file.Name, &file.FileSize, &file.MimeType, &file.URL, &file.ObjectKey, &file.CreatedAt); err != nil {
			return nil, err
		}
		files = append(files, file)
	}
	return files, rows.Err()
}

func (s *Store) UpdateStorageImageFileSize(ctx context.Context, userID, imageID, fileSize int64) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE dndshare.storage_image
		SET file_size = $3
		WHERE id = $1 AND user_id = $2 AND deleted = false AND file_size IS NULL`, imageID, userID, fileSize)
	return err
}
