package web

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"time"

	"github.com/aws/smithy-go"
)

var temporaryCreatureArchive = regexp.MustCompile(`^creature-model-archive-uploads/[0-9a-f-]{36}\.tar\.gz$`)

func creatureArchiveArguments(args map[string]json.RawMessage) (creatureArchiveSpec, error) {
	var spec creatureArchiveSpec
	for key, target := range map[string]any{"itemId": &spec.ItemID, "modelId": &spec.ModelID, "stage": &spec.Stage, "sha256": &spec.SHA256, "size": &spec.Size} {
		if raw, ok := args[key]; !ok || json.Unmarshal(raw, target) != nil {
			return spec, errors.New("complete archive identity and byte metadata required")
		}
	}
	if spec.ItemID <= 0 || !isUUID(spec.ModelID) || (spec.Stage != "native" && spec.Stage != "ready") || !mapSHA.MatchString(spec.SHA256) || spec.Size <= 0 || spec.Size > maxCreatureArchive {
		return spec, errors.New("invalid creature archive metadata")
	}
	return spec, nil
}

func creatureArchiveObjectKey(spec creatureArchiveSpec) string {
	return fmt.Sprintf("creature-model-archives/%d/%s/%s/%s.tar.gz", spec.ItemID, spec.ModelID, spec.Stage, spec.SHA256)
}

func (s *Server) readCreatureArchive(r *http.Request, key string, spec creatureArchiveSpec) (creatureArchiveManifest, error) {
	body, err := s.s3.GetObject(r.Context(), key)
	if err != nil {
		return creatureArchiveManifest{}, err
	}
	defer body.Body.Close()
	if body.ContentLength != spec.Size {
		return creatureArchiveManifest{}, errors.New("archive content length differs")
	}
	return validateCreatureArchive(body.Body, spec)
}

func (s *Server) toolCreatureArchive(r *http.Request, name string, args map[string]json.RawMessage) (any, error) {
	if name == "creature_model_archive_list" {
		itemID, err := argInt64(args, "itemId")
		if err != nil || itemID <= 0 {
			return nil, errors.New("positive handbook itemId required")
		}
		cursor, err := argStringOpt(args, "cursor")
		if err != nil {
			return nil, err
		}
		value := ""
		if cursor != nil {
			value = *cursor
		}
		objects, next, err := s.s3.ListCreatureArchives(r.Context(), fmt.Sprintf("creature-model-archives/%d/", itemID), value)
		return map[string]any{"archives": objects, "nextCursor": next}, err
	}
	if name != "creature_model_archive_get" {
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
	}
	spec, err := creatureArchiveArguments(args)
	if err != nil {
		return nil, err
	}
	key := creatureArchiveObjectKey(spec)
	if name == "creature_model_archive_get" {
		size, err := s.s3.ObjectSize(r.Context(), key)
		if err != nil {
			return nil, err
		}
		if size != spec.Size {
			return nil, errors.New("archive byte size differs")
		}
		url, err := s.s3.PresignGet(r.Context(), key, 15*time.Minute)
		return map[string]any{"key": key, "sha256": spec.SHA256, "size": size, "downloadUrl": url, "expiresInSeconds": 900}, err
	}
	if name == "creature_model_archive_prepare_upload" {
		temporary, url, err := s.s3.PresignCreatureArchiveUpload(r.Context(), spec.Size)
		return map[string]any{"key": key, "uploadKey": temporary, "uploadUrl": url, "expiresInSeconds": 900, "headers": map[string]string{"Content-Type": "application/gzip"}}, err
	}
	if name != "creature_model_archive_complete_upload" {
		return nil, errors.New("unknown creature archive tool")
	}
	size, existsErr := s.s3.ObjectSize(r.Context(), key)
	if existsErr == nil {
		if size != spec.Size {
			return nil, errors.New("immutable archive size differs")
		}
		manifest, err := s.readCreatureArchive(r, key, spec)
		return map[string]any{"key": key, "sha256": spec.SHA256, "size": size, "manifest": manifest}, err
	}
	var api smithy.APIError
	if !errors.As(existsErr, &api) || (api.ErrorCode() != "NotFound" && api.ErrorCode() != "NoSuchKey") {
		return nil, existsErr
	}
	temporary, err := argString(args, "uploadKey")
	if err != nil || !temporaryCreatureArchive.MatchString(temporary) {
		return nil, errors.New("valid temporary archive key required")
	}
	manifest, err := s.readCreatureArchive(r, temporary, spec)
	if err != nil {
		return nil, err
	}
	if err = s.s3.PromoteCreatureArchive(r.Context(), temporary, key); err != nil {
		return nil, err
	}
	if size, err = s.s3.ObjectSize(r.Context(), key); err != nil || size != spec.Size {
		return nil, errors.New("promoted archive byte size differs")
	}
	if err = s.s3.DeleteObject(r.Context(), temporary); err != nil {
		return nil, err
	}
	return map[string]any{"key": key, "sha256": spec.SHA256, "size": size, "manifest": manifest}, nil
}
