package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

// GetSvg возвращает разметку SVG по id (порт SvgStorageRepository.getData; ErrNotFound, если нет).
func (s *Store) GetSvg(ctx context.Context, id int64) (string, error) {
	var data string
	err := s.pool.QueryRow(ctx,
		`SELECT "data" FROM dndshare.svg_storage WHERE id = $1`, id,
	).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	return data, err
}

// SaveSvg сохраняет разметку SVG и возвращает id (порт SvgStorageRepository.save).
func (s *Store) SaveSvg(ctx context.Context, data string) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.svg_storage ("data") VALUES ($1) RETURNING id`, data,
	).Scan(&id)
	return id, err
}

// SaveOwnedSvg stores an SVG uploaded by a user together with the metadata
// required for personal storage accounting. System-generated SVGs use SaveSvg.
func (s *Store) SaveOwnedSvg(ctx context.Context, userID int64, data, fileName, mimeType string, fileSize int64) (int64, error) {
	var id int64
	err := s.pool.QueryRow(ctx,
		`INSERT INTO dndshare.svg_storage ("data", user_id, file_name, mime_type, file_size)
		 VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), $5)
		 RETURNING id`, data, userID, fileName, mimeType, fileSize,
	).Scan(&id)
	return id, err
}

// DeleteSvg удаляет разметку SVG по id (порт SvgStorageRepository.delete).
func (s *Store) DeleteSvg(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.svg_storage WHERE id = $1`, id,
	)
	return err
}

// DeleteSvgIfUnreferenced removes an orphaned SVG without disturbing icons
// shared by another handbook entity.
func (s *Store) DeleteSvgIfUnreferenced(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.svg_storage svg
		  WHERE svg.id = $1
		    AND NOT EXISTS (SELECT 1 FROM dndshare.item i WHERE i.icon_svg_id = svg.id)
		    AND NOT EXISTS (SELECT 1 FROM dndshare.suggest s WHERE s.svg_id = svg.id)
		    AND NOT EXISTS (SELECT 1 FROM dndshare.suggest_type st WHERE st.svg_id = svg.id)`,
		id,
	)
	return err
}
