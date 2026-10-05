package battlemap

import (
	_ "embed"
	"encoding/json"
	"regexp"
)

const DocumentVersion = 2
const MaxTiles = 4096

type ModelMetadata struct {
	ID             string         `json:"id"`
	Collection     string         `json:"collection"`
	CollectionName string         `json:"collectionName"`
	SourceCode     string         `json:"sourceCode"`
	SourceName     string         `json:"sourceName"`
	Name           string         `json:"name"`
	Version        int            `json:"version"`
	TileType       string         `json:"tileType"`
	TerrainType    string         `json:"terrainType"`
	WallLayout     string         `json:"wallLayout"`
	WallMode       string         `json:"wallMode"`
	WallMask       int            `json:"wallMask"`
	Width          int            `json:"width"`
	Height         int            `json:"height"`
	MountDepth     float64        `json:"mountDepth"`
	SurfaceHeight  float64        `json:"surfaceHeight"`
	MaxHeight      float64        `json:"maxHeight"`
	Blockers       [][][2]float64 `json:"blockers"`
	Tags           []string       `json:"tags"`
	SupportSlots   []SupportSlot  `json:"supportSlots"`
}

type SupportSlot struct {
	X         int     `json:"x"`
	Y         int     `json:"y"`
	Width     int     `json:"width"`
	Height    int     `json:"height"`
	Elevation float64 `json:"elevation"`
}

type ModelAsset struct {
	Key      string `json:"key"`
	SHA256   string `json:"sha256"`
	Size     int64  `json:"size"`
	MimeType string `json:"mimeType"`
	FileName string `json:"fileName"`
}

type Model struct {
	ModelMetadata
	Assets map[string]ModelAsset `json:"assets"`
}

//go:embed catalogue.json
var initialCatalogueJSON []byte

func InitialCatalogue() []Model {
	var models []Model
	if err := json.Unmarshal(initialCatalogueJSON, &models); err != nil {
		panic(err)
	}
	return models
}

func InitialModelID(code string) string {
	if id := initialModelIDs[code]; id != "" {
		return id
	}
	panic("missing initial map model: " + code)
}

var initialModelIDs = func() map[string]string {
	result := map[string]string{}
	for _, m := range InitialCatalogue() {
		result[m.SourceCode] = m.ID
	}
	return result
}()

var modelIdentifier = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

func TileFootprint(tile Tile, model ModelMetadata) (int, int) {
	if tile.Rotation == 90 || tile.Rotation == 270 {
		return model.Height, model.Width
	}
	return model.Width, model.Height
}

func ValidateTileModels(d Document, models map[string]ModelMetadata) error {
	_, err := ResolveTilePlacements(d, models)
	return err
}
