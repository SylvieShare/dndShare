package store

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
)

type InventoryIconPreset struct {
	ID         int64  `json:"id"`
	ItemTypeID int64  `json:"itemTypeId"`
	Code       string `json:"code"`
	Name       string `json:"name"`
	Purpose    string `json:"purpose"`
	SortOrder  int    `json:"sortOrder"`
	ImageID    int64  `json:"imageId"`
	ImageURL   string `json:"imageUrl"`
}

func (s *Store) InventoryIconPresets(ctx context.Context) ([]InventoryIconPreset, error) {
	rows, err := s.pool.Query(ctx, `SELECT p.id, p.item_type_id, p.code, p.name, p.purpose, p.sort_order, p.image_id, image.url
        FROM dndshare.item_icon_preset p JOIN dndshare.storage_image image ON image.id=p.image_id AND NOT image.deleted
        ORDER BY p.item_type_id, p.sort_order, p.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	presets := []InventoryIconPreset{}
	for rows.Next() {
		var p InventoryIconPreset
		if err := rows.Scan(&p.ID, &p.ItemTypeID, &p.Code, &p.Name, &p.Purpose, &p.SortOrder, &p.ImageID, &p.ImageURL); err != nil {
			return nil, err
		}
		presets = append(presets, p)
	}
	return presets, rows.Err()
}

func (s *Store) SetInventoryIconPresetImage(ctx context.Context, p InventoryIconPreset, key, url, fileName, mimeType string, fileSize int64) (InventoryIconPreset, *int64, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return p, nil, err
	}
	defer tx.Rollback(ctx)
	// Serialize even the first publication, when the preset row does not exist.
	var typeID int64
	err = tx.QueryRow(ctx, `SELECT id FROM dndshare.item_type WHERE id=$1 FOR UPDATE`, p.ItemTypeID).Scan(&typeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return p, nil, ErrNotFound
	}
	if err != nil {
		return p, nil, err
	}
	var previous *int64
	err = tx.QueryRow(ctx, `SELECT image_id FROM dndshare.item_icon_preset WHERE item_type_id=$1 AND code=$2`, p.ItemTypeID, p.Code).Scan(&previous)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return p, nil, err
	}
	if err = tx.QueryRow(ctx, upsertSystemItemMediaSQL, key, url, "inventory_icon_preset", fileName, mimeType, fileSize).Scan(&p.ImageID); err != nil {
		return p, nil, err
	}
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.item_icon_preset(item_type_id,code,name,purpose,sort_order,image_id)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(item_type_id,code) DO UPDATE
        SET name=EXCLUDED.name, purpose=EXCLUDED.purpose, sort_order=EXCLUDED.sort_order, image_id=EXCLUDED.image_id RETURNING id`,
		p.ItemTypeID, p.Code, p.Name, p.Purpose, p.SortOrder, p.ImageID).Scan(&p.ID)
	if err != nil {
		return p, nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return p, nil, err
	}
	p.ImageURL = url
	return p, previous, nil
}
