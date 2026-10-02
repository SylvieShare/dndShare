package web

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"

	"dndshare/internal/store"
)

var inventoryPresetCode = regexp.MustCompile(`^[a-z][a-z0-9-]{0,63}$`)

func inventoryIconPresetDefinition() map[string]any {
	return mcpDefinition("inventory_icon_preset_set_image", "Create or replace an inventory icon preset associated with a handbook item type. Uploads PNG/WebP to S3 and registers storage_image. Stable identity is (typeId,code); purpose=item is selectable for simplified inventory, empty_cell is the empty bag slot artwork. Requires MCP writes.", mcpObjectSchema(map[string]any{
		"typeId":           mcpIntegerProperty("Positive handbook type id"),
		"code":             mcpStringProperty("Stable lowercase slug, up to 64 characters"),
		"name":             mcpStringProperty("Display name, up to 128 characters"),
		"purpose":          map[string]any{"type": "string", "enum": []string{"item", "empty_cell"}},
		"sortOrder":        mcpIntegerProperty("Display order; default 0"),
		"fileName":         mcpStringProperty("Original image file name"),
		"mimeType":         mcpStringProperty("image/png or image/webp"),
		"dataBase64":       mcpStringProperty("Plain standard base64, at most 5 MB"),
		"preservePrevious": mcpBooleanProperty("Keep replaced image; default false"),
	}, "typeId", "code", "name", "purpose", "fileName", "mimeType", "dataBase64"))
}

func parseInventoryIconPreset(args map[string]json.RawMessage) (store.InventoryIconPreset, mcpSystemItemTypeImage, error) {
	var p store.InventoryIconPreset
	var upload mcpSystemItemTypeImage
	code, err := argString(args, "code")
	if err != nil {
		return p, upload, err
	}
	if !inventoryPresetCode.MatchString(code) {
		return p, upload, errors.New("code must be a lowercase slug up to 64 characters")
	}
	name, err := argString(args, "name")
	if err != nil {
		return p, upload, err
	}
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > 128 {
		return p, upload, errors.New("name must contain 1–128 characters")
	}
	purpose, err := argString(args, "purpose")
	if err != nil {
		return p, upload, err
	}
	if purpose != "item" && purpose != "empty_cell" {
		return p, upload, errors.New("purpose must be item or empty_cell")
	}
	order, err := argInt64Opt(args, "sortOrder")
	if err != nil {
		return p, upload, err
	}
	if order != nil && (*order < 0 || *order > 10000) {
		return p, upload, errors.New("sortOrder must be between 0 and 10000")
	}
	imageArgs := make(map[string]json.RawMessage, len(args)+1)
	for key, value := range args {
		imageArgs[key] = value
	}
	imageArgs["slot"] = json.RawMessage(`"icon"`)
	upload, err = parseMCPSystemItemTypeImage(imageArgs)
	if err != nil {
		return p, upload, err
	}
	p = store.InventoryIconPreset{ItemTypeID: upload.TypeID, Code: code, Name: name, Purpose: purpose}
	if order != nil {
		p.SortOrder = int(*order)
	}
	return p, upload, nil
}

func (s *Server) toolInventoryIconPresetSetImage(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	p, upload, err := parseInventoryIconPreset(args)
	if err != nil {
		return nil, err
	}
	if _, err = s.store.ItemTypeGetById(ctx, p.ItemTypeID); err != nil {
		return nil, err
	}
	key := systemMediaKey(fmt.Sprintf("inventory-presets/%d/%s", p.ItemTypeID, p.Code), "icon", upload.MIMEType, upload.Data)
	stored, err := s.s3.UploadSystemItemMedia(ctx, bytes.NewReader(upload.Data), int64(len(upload.Data)), key, upload.MIMEType)
	if err != nil {
		return nil, err
	}
	p, previous, err := s.store.SetInventoryIconPresetImage(ctx, p, stored.Key, stored.URL, upload.FileName, upload.MIMEType, int64(len(upload.Data)))
	if err != nil {
		return nil, err
	}
	if !upload.PreservePrevious {
		s.cleanupItemStorageImage(ctx, previous)
	}
	return map[string]any{"preset": p, "objectKey": stored.Key, "fileSize": len(upload.Data)}, nil
}
