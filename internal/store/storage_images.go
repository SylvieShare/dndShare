package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// StorageImageRecord — строка dndshare.storage_image (порт StorageImageRepository.StorageImageRecord).
type StorageImageRecord struct {
	ID     int64
	UserID *int64
	Key    *string
	URL    string
	Type   *string
}

// SaveStorageImage сохраняет объект и возвращает id (порт StorageImageRepository.saveObject).
func (s *Store) SaveStorageImage(ctx context.Context, userID int64, key, url, typ string) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.storage_image (user_id, "key", url, "type")
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		userID, key, url, typ,
	).Scan(&id)
	return id, err
}

// GetActiveUserStorageImage — активный объект пользователя (порт getActiveUserObject).
func (s *Store) GetActiveUserStorageImage(ctx context.Context, id, userID int64) (StorageImageRecord, error) {
	return s.scanStorageImage(ctx,
		`SELECT id, user_id, "key", url, "type"
		 FROM dndshare.storage_image
		 WHERE id = $1 AND user_id = $2 AND deleted = false`,
		id, userID,
	)
}

// GetActiveStorageImage — активный объект по id (порт getActiveObject).
func (s *Store) GetActiveStorageImage(ctx context.Context, id int64) (StorageImageRecord, error) {
	return s.scanStorageImage(ctx,
		`SELECT id, user_id, "key", url, "type"
		 FROM dndshare.storage_image
		 WHERE id = $1 AND deleted = false`,
		id,
	)
}

// GetActiveStorageImageByURL — активный объект по url и типу (порт getActiveObjectByUrl).
func (s *Store) GetActiveStorageImageByURL(ctx context.Context, url, typ string) (StorageImageRecord, error) {
	return s.scanStorageImage(ctx,
		`SELECT id, user_id, "key", url, "type"
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
		    AND NOT EXISTS (SELECT 1 FROM dndshare.session_chapter ch WHERE ch.custom_image_id = img.id)
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
	err := s.pool.QueryRow(ctx, query, args...).Scan(&rec.ID, &rec.UserID, &rec.Key, &rec.URL, &rec.Type)
	if errors.Is(err, pgx.ErrNoRows) {
		return StorageImageRecord{}, ErrNotFound
	}
	return rec, err
}
