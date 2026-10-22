package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

type MapDecalImage struct {
	PixelWidth  int    `json:"pixelWidth"`
	PixelHeight int    `json:"pixelHeight"`
	ID          string `json:"id"`
	Name        string `json:"name"`
	Category    string `json:"category"`
	ImageURL    string `json:"imageUrl"`
}

func (s *Store) CreateMapDecalImage(ctx context.Context, userID int64, key, url, name, mime, category string, size int64, width, height int) (MapDecalImage, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return MapDecalImage{}, err
	}
	defer tx.Rollback(ctx)
	var imageID int64
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.storage_image(user_id,"key",url,"type",file_name,mime_type,file_size) VALUES($1,$2,$3,'map_decal',$4,$5,$6) RETURNING id`, userID, key, url, name, mime, size).Scan(&imageID)
	if err != nil {
		return MapDecalImage{}, err
	}
	image := MapDecalImage{Name: name, Category: category, PixelWidth: width, PixelHeight: height}
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.map_decal_image(user_id,image_id,name,category,pixel_width,pixel_height) VALUES($1,$2,$3,$4,$5,$6) RETURNING id::text`, userID, imageID, name, category, width, height).Scan(&image.ID)
	if err != nil {
		return image, err
	}
	image.ImageURL = "/api/map-decal-images/" + image.ID
	return image, tx.Commit(ctx)
}

func (s *Store) ListMapDecalImages(ctx context.Context, userID int64) ([]MapDecalImage, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text,name,category,pixel_width,pixel_height FROM dndshare.map_decal_image WHERE user_id=$1 ORDER BY created_at DESC,id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	images := []MapDecalImage{}
	for rows.Next() {
		var image MapDecalImage
		if err := rows.Scan(&image.ID, &image.Name, &image.Category, &image.PixelWidth, &image.PixelHeight); err != nil {
			return nil, err
		}
		image.ImageURL = "/api/map-decal-images/" + image.ID
		images = append(images, image)
	}
	return images, rows.Err()
}

func (s *Store) GetMapDecalImageFile(ctx context.Context, id string) (key, mime string, err error) {
	err = s.pool.QueryRow(ctx, `SELECT i."key",i.mime_type FROM dndshare.map_decal_image d JOIN dndshare.storage_image i ON i.id=d.image_id WHERE d.id=$1::uuid AND NOT i.deleted`, id).Scan(&key, &mime)
	if errors.Is(err, pgx.ErrNoRows) {
		err = ErrNotFound
	}
	return
}
