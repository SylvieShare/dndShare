package web

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"dndshare/internal/store"
)

func suggestImageDefinition() map[string]any {
	return mcpDefinition("handbook_suggest_set_system_image", "Install a PNG/WebP icon on a base dictionary entry identified by (typeId,id). Stores the image in S3 and its shared storage_image ID on the suggest; raster icons take precedence over SVG. Requires MCP writes.", mcpObjectSchema(map[string]any{
		"typeId":           mcpIntegerProperty("Positive suggest type id"),
		"id":               mcpIntegerProperty("Positive suggest id within that type"),
		"fileName":         mcpStringProperty("Original image file name"),
		"mimeType":         mcpStringProperty("image/png or image/webp"),
		"dataBase64":       mcpStringProperty("Plain standard base64, at most 5 MB"),
		"preservePrevious": mcpBooleanProperty("Keep replaced image; default false"),
	}, "typeId", "id", "fileName", "mimeType", "dataBase64"))
}

func parseMCPSuggestImage(args map[string]json.RawMessage) (int64, mcpSystemItemImage, error) {
	typeID, err := argInt64(args, "typeId")
	if err != nil {
		return 0, mcpSystemItemImage{}, err
	}
	if typeID <= 0 {
		return 0, mcpSystemItemImage{}, errors.New("typeId must be a positive integer")
	}
	id, err := argInt64(args, "id")
	if err != nil {
		return 0, mcpSystemItemImage{}, err
	}
	if id <= 0 {
		return 0, mcpSystemItemImage{}, errors.New("id must be a positive integer")
	}
	imageArgs := make(map[string]json.RawMessage, len(args)+2)
	for key, value := range args {
		imageArgs[key] = value
	}
	imageArgs["itemId"] = json.RawMessage(fmt.Sprintf("%d", id))
	imageArgs["slot"] = json.RawMessage(`"icon"`)
	upload, err := parseMCPSystemItemImage(imageArgs)
	return typeID, upload, err
}

func (s *Server) toolSuggestSetSystemImage(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, upload, err := parseMCPSuggestImage(args)
	if err != nil {
		return nil, err
	}
	old, err := s.store.GetEditableSuggest(ctx, upload.ItemID, typeID, mcpAdminUser, true)
	if err != nil {
		return nil, err
	}
	if old.UserID != nil {
		return nil, errors.New("system image target must be a base suggest")
	}
	key := systemMediaKey(fmt.Sprintf("suggests/%d/%d", typeID, upload.ItemID), "icon", upload.MIMEType, upload.Data)
	stored, err := s.s3.UploadSystemItemMedia(ctx, bytes.NewReader(upload.Data), int64(len(upload.Data)), key, upload.MIMEType)
	if err != nil {
		return nil, err
	}
	imageID, previous, err := s.store.SetSystemSuggestImage(ctx, typeID, upload.ItemID, stored.Key, stored.URL, upload.FileName, upload.MIMEType, int64(len(upload.Data)))
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, fmt.Errorf("base suggest (%d,%d) not found", typeID, upload.ItemID)
		}
		return nil, err
	}
	if !upload.PreservePrevious {
		s.cleanupItemStorageImage(ctx, previous)
	}
	updated, err := s.store.GetEditableSuggest(ctx, upload.ItemID, typeID, mcpAdminUser, true)
	if err != nil {
		return nil, err
	}
	return map[string]any{"suggest": updated, "imageId": imageID, "objectKey": stored.Key, "fileSize": len(upload.Data), "preservedPrevious": upload.PreservePrevious}, nil
}
