package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// StorageImageRecord — строка dndshare.storage_image (порт StorageImageRepository.StorageImageRecord).
type StorageImageRecord struct {
	ID     int64
	UserID int64
	Key    string
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

// MarkStorageImageDeletedByUser помечает объект удалённым (порт markDeleted(id, userId)).
func (s *Store) MarkStorageImageDeletedByUser(ctx context.Context, id, userID int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.storage_image SET deleted = true WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	return err
}

// MarkStorageImageDeleted помечает объект удалённым (порт markDeleted(id)).
func (s *Store) MarkStorageImageDeleted(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.storage_image SET deleted = true WHERE id = $1`,
		id,
	)
	return err
}

func (s *Store) scanStorageImage(ctx context.Context, query string, args ...any) (StorageImageRecord, error) {
	var rec StorageImageRecord
	err := s.pool.QueryRow(ctx, query, args...).Scan(&rec.ID, &rec.UserID, &rec.Key, &rec.URL, &rec.Type)
	if errors.Is(err, pgx.ErrNoRows) {
		return StorageImageRecord{}, ErrNotFound
	}
	return rec, err
}
