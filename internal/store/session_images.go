package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type SessionImageCatalogEntry struct {
	ImageID       int64  `json:"id"`
	CatalogKey    string `json:"key"`
	Scope         string `json:"scope"`
	CategoryKey   string `json:"categoryKey"`
	CategoryLabel string `json:"categoryLabel"`
	Label         string `json:"label"`
	SortOrder     int    `json:"sortOrder"`
	URL           string `json:"url"`
}

func (s *Store) ListSessionImageCatalog(ctx context.Context, scope string) ([]SessionImageCatalogEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT catalog.image_id, catalog.catalog_key, catalog.scope,
		       catalog.category_key, catalog.category_label, catalog.label,
		       catalog.sort_order, COALESCE(image.url, '')
		FROM dndshare.session_image_catalog catalog
		JOIN dndshare.storage_image image ON image.id = catalog.image_id AND image.deleted = false
		WHERE catalog.scope = $1
		ORDER BY catalog.sort_order, catalog.image_id`, scope)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	entries := []SessionImageCatalogEntry{}
	for rows.Next() {
		var entry SessionImageCatalogEntry
		if err := rows.Scan(
			&entry.ImageID, &entry.CatalogKey, &entry.Scope,
			&entry.CategoryKey, &entry.CategoryLabel, &entry.Label,
			&entry.SortOrder, &entry.URL,
		); err != nil {
			return nil, err
		}
		entries = append(entries, entry)
	}
	return entries, rows.Err()
}

func (s *Store) GetSessionImageCatalogEntry(ctx context.Context, imageID int64) (SessionImageCatalogEntry, error) {
	var entry SessionImageCatalogEntry
	err := s.pool.QueryRow(ctx, `
		SELECT catalog.image_id, catalog.catalog_key, catalog.scope,
		       catalog.category_key, catalog.category_label, catalog.label,
		       catalog.sort_order, COALESCE(image.url, '')
		FROM dndshare.session_image_catalog catalog
		JOIN dndshare.storage_image image ON image.id = catalog.image_id AND image.deleted = false
		WHERE catalog.image_id = $1`, imageID).Scan(
		&entry.ImageID, &entry.CatalogKey, &entry.Scope,
		&entry.CategoryKey, &entry.CategoryLabel, &entry.Label,
		&entry.SortOrder, &entry.URL,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionImageCatalogEntry{}, ErrNotFound
	}
	return entry, err
}

func (s *Store) UserCanUseSessionImage(ctx context.Context, imageID, userID int64, scope string) (bool, error) {
	var allowed bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM dndshare.storage_image image
			LEFT JOIN dndshare.session_image_catalog catalog ON catalog.image_id = image.id
			WHERE image.id = $1 AND image.deleted = false
			  AND ((image.user_id = $2 AND image."type" = 'image') OR catalog.scope = $3)
		)`, imageID, userID, scope).Scan(&allowed)
	return allowed, err
}

func (s *Store) UpdateSystemSessionImageURL(ctx context.Context, catalogKey, objectKey, url string) error {
	result, err := s.pool.Exec(ctx, `
		UPDATE dndshare.storage_image image
		SET "key" = $2, url = $3, "type" = 'session-image', deleted = false
		FROM dndshare.session_image_catalog catalog
		WHERE catalog.image_id = image.id AND catalog.catalog_key = $1`, catalogKey, objectKey, url)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
