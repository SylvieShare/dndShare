package web

import (
	"bytes"
	"dndshare/internal/battlemap"
	"encoding/json"
	"errors"
	"golang.org/x/image/webp"
	"net/http"
)

func transparentMapPreview(data []byte) error {
	config, err := webp.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return errors.New("preview must be a decodable WebP")
	}
	if config.Width < 1 || config.Height < 1 || config.Width > 2048 || config.Height > 2048 {
		return errors.New("preview dimensions exceed 2048 pixels")
	}
	image, err := webp.Decode(bytes.NewReader(data))
	if err != nil {
		return errors.New("invalid preview pixels")
	}
	for _, point := range [][2]int{{0, 0}, {config.Width - 1, 0}, {0, config.Height - 1}, {config.Width - 1, config.Height - 1}} {
		_, _, _, alpha := image.At(point[0], point[1]).RGBA()
		if alpha != 0 {
			return errors.New("preview background must be transparent")
		}
	}
	for y := 0; y < config.Height; y++ {
		for x := 0; x < config.Width; x++ {
			_, _, _, alpha := image.At(x, y).RGBA()
			if alpha > 0 {
				return nil
			}
		}
	}
	return errors.New("preview must contain a visible model")
}

func (s *Server) toolRegisterMapPreview(r *http.Request, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	id, err := argString(args, "id")
	if err != nil || !isUUID(id) {
		return nil, errors.New("model UUID required")
	}
	sha, err := argString(args, "expectedRenderSHA256")
	if err != nil || !mapSHA.MatchString(sha) {
		return nil, errors.New("expected render SHA-256 required")
	}
	var asset battlemap.ModelAsset
	if err = json.Unmarshal(args["asset"], &asset); err != nil {
		return nil, errors.New("preview asset metadata required")
	}
	input := map[string]json.RawMessage{}
	for key, value := range map[string]any{"kind": "preview", "fileName": asset.FileName, "sha256": asset.SHA256, "size": asset.Size} {
		input[key], _ = json.Marshal(value)
	}
	_, expected, err := parseMapAsset(input)
	if err != nil {
		return nil, err
	}
	if expected != asset {
		return nil, errors.New("preview metadata differs from upload result")
	}
	if err = s.verifyMapAsset(r, asset.Key, asset); err != nil {
		return nil, err
	}
	return s.store.UpdateMapModelPreview(r.Context(), id, sha, asset)
}
