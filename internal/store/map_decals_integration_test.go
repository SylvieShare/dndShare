package store

import (
	"strings"
	"testing"
)

func TestMapDecalImagesPostgres(t *testing.T) {
	pool := schemaTestPool(t)
	if err := applySchema(t.Context(), pool); err != nil {
		t.Fatal(err)
	}
	schemaTestExec(t, pool, `INSERT INTO dndshare.source(id,name) VALUES(1,'DND5e'); INSERT INTO dndshare.source_version(id,source_id,version) VALUES(1,1,'2014'); INSERT INTO dndshare.users(id,login,password,source_version_id) VALUES(1,'decal-owner','test',1),(2,'other-owner','test',1)`)
	s := &Store{pool: pool}
	asset, err := s.CreateMapDecalImage(t.Context(), 1, "map-decals/test.webp", "https://example.com/test.webp", "Руна", "image/webp", "graffiti", 128, 400, 200)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(asset.ImageURL, "/api/map-decal-images/") || asset.PixelWidth != 400 {
		t.Fatalf("unexpected image %+v", asset)
	}
	list, err := s.ListMapDecalImages(t.Context(), 1)
	if err != nil || len(list) != 1 || list[0] != asset {
		t.Fatalf("library: %+v %v", list, err)
	}
	other, err := s.ListMapDecalImages(t.Context(), 2)
	if err != nil || len(other) != 0 {
		t.Fatalf("library isolation: %+v %v", other, err)
	}
	key, mime, err := s.GetMapDecalImageFile(t.Context(), asset.ID)
	if err != nil || key != "map-decals/test.webp" || mime != "image/webp" {
		t.Fatalf("public texture: %q %q %v", key, mime, err)
	}
	var imageID int64
	if err := pool.QueryRow(t.Context(), `SELECT image_id FROM dndshare.map_decal_image WHERE id=$1::uuid`, asset.ID).Scan(&imageID); err != nil {
		t.Fatal(err)
	}
	if key, err := s.MarkStorageImageDeletedIfUnreferenced(t.Context(), imageID); err != nil || key != nil {
		t.Fatalf("library image lost reference: %v %v", key, err)
	}
	if _, err := s.CreateMapDecalImage(t.Context(), 1, "map-decals/invalid.webp", "/invalid.webp", "Bad", "image/webp", "invalid", 128, 400, 200); err == nil {
		t.Fatal("invalid category accepted")
	}
	var rows int
	if err := pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare.storage_image WHERE "key"='map-decals/invalid.webp'`).Scan(&rows); err != nil || rows != 0 {
		t.Fatalf("failed upload left a storage row: %d %v", rows, err)
	}
}
