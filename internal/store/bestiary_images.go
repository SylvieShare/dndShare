package store

import "context"

type ExternalBestiaryImage struct {
	ID   int64
	URL  string
	Slug string
}

func (s *Store) ListExternalBestiaryImages(ctx context.Context) ([]ExternalBestiaryImage, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT image.id, image.url, COALESCE(NULLIF(item.name_en, ''), item.id::text)
		 FROM dndshare.storage_image image
		 JOIN dndshare.item item ON item.icon_image_id = image.id
		 WHERE image."type" = 'bestiary'
		   AND image.deleted = false
		   AND (image."key" IS NULL OR btrim(image."key") = '')
		   AND image.url ~ '^https?://'
		 ORDER BY image.id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []ExternalBestiaryImage{}
	for rows.Next() {
		var image ExternalBestiaryImage
		if err := rows.Scan(&image.ID, &image.URL, &image.Slug); err != nil {
			return nil, err
		}
		result = append(result, image)
	}
	return result, rows.Err()
}

func (s *Store) UpdateBestiaryImageStorage(ctx context.Context, imageID int64, key, url string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE dndshare.storage_image
		 SET "key" = $1, url = $2, deleted = false
		 WHERE id = $3 AND "type" = 'bestiary'`,
		key, url, imageID,
	)
	return err
}
