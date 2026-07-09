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

// DeleteSvg удаляет разметку SVG по id (порт SvgStorageRepository.delete).
func (s *Store) DeleteSvg(ctx context.Context, id int64) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM dndshare.svg_storage WHERE id = $1`, id,
	)
	return err
}
