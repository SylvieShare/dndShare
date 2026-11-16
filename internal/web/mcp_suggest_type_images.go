package web

import (
	"bytes"
	"context"
	"dndshare/internal/store"
	"encoding/json"
	"fmt"
)

func suggestTypeImageDefinition() map[string]any {
	return mcpDefinition("handbook_suggest_type_set_system_image", "Install an independent icon or fallback cover on a dictionary section. Uses shared storage_image and content-addressed S3 media; requires MCP writes.", mcpObjectSchema(map[string]any{
		"typeId":   mcpIntegerProperty("Positive dictionary type id"),
		"slot":     map[string]any{"type": "string", "enum": []string{"icon", "cover"}},
		"fileName": mcpStringProperty("Original image filename"), "mimeType": mcpStringProperty("PNG/WebP icon; JPEG/PNG/WebP cover"),
		"dataBase64":       mcpStringProperty("Plain standard base64; icon up to 5 MB, cover up to 10 MB"),
		"preservePrevious": mcpBooleanProperty("Keep the previous image object; default false"),
	}, "typeId", "slot", "fileName", "mimeType", "dataBase64"))
}

func (s *Server) toolSuggestTypeSetSystemImage(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	typeID, err := argInt64(args, "typeId")
	if err != nil || typeID <= 0 {
		return nil, fmt.Errorf("positive typeId required")
	}
	imageArgs := map[string]json.RawMessage{}
	for key, value := range args {
		imageArgs[key] = value
	}
	imageArgs["itemId"] = json.RawMessage(fmt.Sprint(typeID))
	upload, err := parseMCPSystemItemImage(imageArgs)
	if err != nil {
		return nil, err
	}
	types, err := s.store.GetAllSuggestTypes(ctx, nil)
	if err != nil {
		return nil, err
	}
	found := false
	for _, t := range types {
		if t.ID == typeID {
			found = true
			break
		}
	}
	if !found {
		return nil, store.ErrNotFound
	}
	key := systemMediaKey(fmt.Sprintf("suggest-types/%d", typeID), upload.Slot, upload.MIMEType, upload.Data)
	stored, err := s.s3.UploadSystemItemMedia(ctx, bytes.NewReader(upload.Data), int64(len(upload.Data)), key, upload.MIMEType)
	if err != nil {
		return nil, err
	}
	imageID, previous, err := s.store.SetSystemSuggestTypeImage(ctx, typeID, upload.Slot, stored.Key, stored.URL, upload.FileName, upload.MIMEType, int64(len(upload.Data)))
	if err != nil {
		return nil, err
	}
	if !upload.PreservePrevious {
		s.cleanupItemStorageImage(ctx, previous)
	}
	types, err = s.store.GetAllSuggestTypes(ctx, nil)
	if err != nil {
		return nil, err
	}
	for _, t := range types {
		if t.ID == typeID {
			return map[string]any{"suggestType": t, "imageId": imageID, "objectKey": stored.Key, "fileSize": len(upload.Data), "preservedPrevious": upload.PreservePrevious}, nil
		}
	}
	return nil, store.ErrNotFound
}
