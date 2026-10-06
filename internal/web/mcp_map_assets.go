package web

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"

	"dndshare/internal/battlemap"
	"github.com/aws/smithy-go"
)

var mapSHA = regexp.MustCompile(`^[0-9a-f]{64}$`)
var temporaryMapAsset = regexp.MustCompile(`^map-model-uploads/[0-9a-f-]{36}\.(glb|stl|webp)$`)

func parseMapAsset(args map[string]json.RawMessage) (string, battlemap.ModelAsset, error) {
	kind, err := argString(args, "kind")
	if err != nil {
		return "", battlemap.ModelAsset{}, err
	}
	name, err := argString(args, "fileName")
	if err != nil {
		return "", battlemap.ModelAsset{}, err
	}
	sha, err := argString(args, "sha256")
	if err != nil {
		return "", battlemap.ModelAsset{}, err
	}
	size, err := argInt64(args, "size")
	if err != nil {
		return "", battlemap.ModelAsset{}, err
	}
	name = safeUploadFileName(name)
	if name == "" || !mapSHA.MatchString(sha) {
		return "", battlemap.ModelAsset{}, errors.New("fileName and lowercase SHA-256 are required")
	}
	ext := strings.ToLower(filepath.Ext(name))
	mime := ""
	limit := int64(32 << 20)
	switch kind {
	case "render", "lod", "shadow":
		if ext == ".glb" {
			mime = "model/gltf-binary"
		}
	case "preview":
		limit = 4 << 20
		if ext == ".webp" {
			mime = "image/webp"
		}
	case "source":
		limit = 256 << 20
		if ext == ".stl" {
			mime = "model/stl"
		} else if ext == ".glb" {
			mime = "model/gltf-binary"
		}
	}
	if mime == "" || size <= 0 || size > limit {
		return "", battlemap.ModelAsset{}, errors.New("invalid asset kind, extension or byte size")
	}
	return kind, battlemap.ModelAsset{Key: "map-models/" + sha + ext, SHA256: sha, Size: size, MimeType: mime, FileName: name}, nil
}

func (s *Server) toolPrepareMapUpload(r *http.Request, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	_, asset, err := parseMapAsset(args)
	if err != nil {
		return nil, err
	}
	key, url, err := s.s3.PresignMapUpload(r.Context(), asset.MimeType, asset.Size, strings.TrimPrefix(strings.ToLower(filepath.Ext(asset.FileName)), "."))
	if err != nil {
		return nil, err
	}
	return map[string]any{"uploadKey": key, "uploadUrl": url, "expiresInSeconds": 900, "headers": map[string]string{"Content-Type": asset.MimeType}, "asset": asset}, nil
}

func assetFormat(header []byte, asset battlemap.ModelAsset) error {
	switch asset.MimeType {
	case "model/gltf-binary":
		if len(header) < 12 || string(header[:4]) != "glTF" || binary.LittleEndian.Uint32(header[4:8]) != 2 || int64(binary.LittleEndian.Uint32(header[8:12])) != asset.Size {
			return errors.New("invalid GLB header or declared length")
		}
	case "model/stl":
		if len(header) < 84 || int64(binary.LittleEndian.Uint32(header[80:84]))*50+84 != asset.Size {
			return errors.New("source must be a binary STL with valid triangle count")
		}
	case "image/webp":
		if len(header) < 12 || string(header[:4]) != "RIFF" || string(header[8:12]) != "WEBP" {
			return errors.New("preview must be WebP")
		}
	}
	return nil
}

func (s *Server) verifyMapAsset(r *http.Request, key string, asset battlemap.ModelAsset) error {
	body, err := s.s3.GetObject(r.Context(), key)
	if err != nil {
		return err
	}
	defer body.Body.Close()
	if body.ContentLength != asset.Size {
		return errors.New("uploaded asset size mismatch")
	}
	hash := sha256.New()
	reader := io.TeeReader(io.LimitReader(body.Body, asset.Size+1), hash)
	header := make([]byte, min(asset.Size, 84))
	if _, err = io.ReadFull(reader, header); err != nil {
		return err
	}
	if err = assetFormat(header, asset); err != nil {
		return err
	}
	read := int64(len(header))
	if asset.MimeType == "model/gltf-binary" {
		if len(header) < 20 || string(header[16:20]) != "JSON" {
			return errors.New("GLB JSON chunk required")
		}
		jsonSize := int(binary.LittleEndian.Uint32(header[12:16]))
		if jsonSize < 2 || jsonSize > 2<<20 || int64(jsonSize)+20 > asset.Size {
			return errors.New("invalid GLB JSON chunk size")
		}
		data := make([]byte, jsonSize)
		copied := copy(data, header[20:])
		if _, err = io.ReadFull(reader, data[copied:]); err != nil {
			return err
		}
		read += int64(jsonSize - copied)
		var document struct {
			Buffers []struct {
				URI string `json:"uri"`
			} `json:"buffers"`
			Images []struct {
				URI string `json:"uri"`
			} `json:"images"`
			Meshes []json.RawMessage `json:"meshes"`
		}
		if json.Unmarshal(data, &document) != nil || len(document.Buffers) == 0 || len(document.Meshes) == 0 {
			return errors.New("GLB must contain a valid mesh")
		}
		for _, b := range document.Buffers {
			if b.URI != "" {
				return errors.New("external GLB buffers are not accepted")
			}
		}
		for _, i := range document.Images {
			if i.URI != "" {
				return errors.New("external GLB images are not accepted")
			}
		}
	}
	n, err := io.Copy(io.Discard, reader)
	if err != nil {
		return err
	}
	if n+read != asset.Size || hex.EncodeToString(hash.Sum(nil)) != asset.SHA256 {
		return errors.New("uploaded asset SHA-256 mismatch")
	}
	return nil
}

func (s *Server) toolCompleteMapUpload(r *http.Request, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	_, asset, err := parseMapAsset(args)
	if err != nil {
		return nil, err
	}
	key, err := argString(args, "uploadKey")
	if err != nil {
		return nil, err
	}
	if !temporaryMapAsset.MatchString(key) || filepath.Ext(key) != strings.ToLower(filepath.Ext(asset.FileName)) {
		return nil, errors.New("invalid temporary upload key")
	}
	if err = s.verifyMapAsset(r, key, asset); err != nil {
		return nil, err
	}
	_, err = s.s3.ObjectSize(r.Context(), asset.Key)
	if err == nil {
		if err = s.verifyMapAsset(r, asset.Key, asset); err != nil {
			return nil, fmt.Errorf("existing immutable asset differs: %w", err)
		}
	} else {
		var api smithy.APIError
		if !errors.As(err, &api) || (api.ErrorCode() != "NotFound" && api.ErrorCode() != "NoSuchKey") {
			return nil, err
		}
		if err = s.s3.PromoteMapUpload(r.Context(), key, asset.Key, asset.MimeType); err != nil {
			return nil, err
		}
	}
	if err = s.verifyMapAsset(r, asset.Key, asset); err != nil {
		return nil, err
	}
	if err = s.s3.DeleteObject(r.Context(), key); err != nil {
		return nil, err
	}
	return asset, nil
}
