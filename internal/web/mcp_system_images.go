package web

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"dndshare/internal/store"
)

const (
	maxMCPSystemIconBytes  = 5 << 20
	maxMCPSystemCoverBytes = 10 << 20
)

type mcpSystemItemImage struct {
	ItemID           int64
	Slot             string
	FileName         string
	MIMEType         string
	Data             []byte
	PreservePrevious bool
}

func (s *Server) toolSystemBestiaryMigrateIconsToCovers(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	apply, err := argBoolDefault(args, "apply", false)
	if err != nil {
		return nil, err
	}
	if apply {
		if err := s.mcpRequireWrite(); err != nil {
			return nil, err
		}
	}
	excludeItemIDs, err := argInt64SliceDefault(args, "excludeItemIds", []int64{})
	if err != nil {
		return nil, err
	}
	excludeItemIDs = uniquePositiveIDs(excludeItemIDs)
	if excludeItemIDs == nil {
		return nil, errors.New("excludeItemIds must contain only positive integers")
	}
	expectedCandidateCount, err := argInt64Opt(args, "expectedCandidateCount")
	if err != nil {
		return nil, err
	}
	if expectedCandidateCount != nil && *expectedCandidateCount < 0 {
		return nil, errors.New("expectedCandidateCount must not be negative")
	}
	if apply && expectedCandidateCount == nil {
		return nil, errors.New("expectedCandidateCount is required when apply=true; run a dry-run first")
	}

	return s.store.MigrateSystemBestiaryIconsToCovers(
		ctx,
		excludeItemIDs,
		apply,
		expectedCandidateCount,
	)
}

func uniquePositiveIDs(ids []int64) []int64 {
	result := make([]int64, 0, len(ids))
	seen := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
	}
	return result
}

func (s *Server) toolSystemItemSetImage(ctx context.Context, args map[string]json.RawMessage) (any, error) {
	if err := s.mcpRequireWrite(); err != nil {
		return nil, err
	}
	upload, err := parseMCPSystemItemImage(args)
	if err != nil {
		return nil, err
	}

	exists, err := s.store.SystemItemExists(ctx, upload.ItemID)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, fmt.Errorf("system handbook item %d not found", upload.ItemID)
	}

	key := systemItemMediaKey(upload.ItemID, upload.Slot, upload.MIMEType, upload.Data)
	stored, err := s.s3.UploadSystemItemMedia(
		ctx,
		bytes.NewReader(upload.Data),
		int64(len(upload.Data)),
		key,
		upload.MIMEType,
	)
	if err != nil {
		return nil, err
	}

	imageID, replaced, err := s.store.SetSystemItemImage(
		ctx,
		upload.ItemID,
		upload.Slot,
		stored.Key,
		stored.URL,
		upload.FileName,
		upload.MIMEType,
		int64(len(upload.Data)),
	)
	if err != nil {
		if errors.Is(err, store.ErrNotFound) {
			return nil, fmt.Errorf("system handbook item %d not found", upload.ItemID)
		}
		return nil, err
	}
	if !upload.PreservePrevious {
		s.cleanupItemIconContext(ctx, replaced)
	}

	items, err := s.store.GetByIds(ctx, []int64{upload.ItemID}, nil)
	if err != nil {
		return nil, err
	}
	if len(items) != 1 {
		return nil, fmt.Errorf("system handbook item %d disappeared after image installation", upload.ItemID)
	}
	return map[string]any{
		"item":              items[0],
		"slot":              upload.Slot,
		"imageId":           imageID,
		"imageUrl":          stored.URL,
		"objectKey":         stored.Key,
		"fileName":          upload.FileName,
		"mimeType":          upload.MIMEType,
		"fileSize":          len(upload.Data),
		"preservedPrevious": upload.PreservePrevious,
	}, nil
}

func parseMCPSystemItemImage(args map[string]json.RawMessage) (mcpSystemItemImage, error) {
	itemID, err := argInt64(args, "itemId")
	if err != nil {
		return mcpSystemItemImage{}, err
	}
	if itemID <= 0 {
		return mcpSystemItemImage{}, errors.New("itemId must be a positive integer")
	}
	slot, err := argString(args, "slot")
	if err != nil {
		return mcpSystemItemImage{}, err
	}
	slot = strings.ToLower(strings.TrimSpace(slot))
	if slot != "icon" && slot != "cover" {
		return mcpSystemItemImage{}, errors.New("slot must be icon or cover")
	}
	fileName, err := argString(args, "fileName")
	if err != nil {
		return mcpSystemItemImage{}, err
	}
	fileName = safeUploadFileName(fileName)
	if fileName == "" {
		return mcpSystemItemImage{}, errors.New("fileName must not be empty")
	}
	mimeType, err := argString(args, "mimeType")
	if err != nil {
		return mcpSystemItemImage{}, err
	}
	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	if err := validateMCPSystemItemMIME(slot, mimeType); err != nil {
		return mcpSystemItemImage{}, err
	}
	encoded, err := argString(args, "dataBase64")
	if err != nil {
		return mcpSystemItemImage{}, err
	}
	encoded = strings.TrimSpace(encoded)
	if strings.HasPrefix(strings.ToLower(encoded), "data:") {
		return mcpSystemItemImage{}, errors.New("dataBase64 must contain plain base64 without a data URL prefix")
	}
	maxBytes := maxMCPSystemCoverBytes
	if slot == "icon" {
		maxBytes = maxMCPSystemIconBytes
	}
	if encoded == "" || base64.StdEncoding.DecodedLen(len(encoded)) > maxBytes {
		return mcpSystemItemImage{}, fmt.Errorf("%s image must be between 1 byte and %d MB", slot, maxBytes>>20)
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return mcpSystemItemImage{}, errors.New("dataBase64 must be valid standard base64")
	}
	if len(data) == 0 || len(data) > maxBytes {
		return mcpSystemItemImage{}, fmt.Errorf("%s image must be between 1 byte and %d MB", slot, maxBytes>>20)
	}
	detected := http.DetectContentType(data)
	if detected != mimeType {
		return mcpSystemItemImage{}, fmt.Errorf("mimeType %q does not match detected content type %q", mimeType, detected)
	}
	preservePrevious, err := argBoolDefault(args, "preservePrevious", false)
	if err != nil {
		return mcpSystemItemImage{}, err
	}
	return mcpSystemItemImage{
		ItemID:           itemID,
		Slot:             slot,
		FileName:         fileName,
		MIMEType:         mimeType,
		Data:             data,
		PreservePrevious: preservePrevious,
	}, nil
}

func validateMCPSystemItemMIME(slot, mimeType string) error {
	switch slot {
	case "icon":
		if mimeType != "image/png" && mimeType != "image/webp" {
			return errors.New("icon mimeType must be image/png or image/webp")
		}
	case "cover":
		if mimeType != "image/jpeg" && mimeType != "image/png" && mimeType != "image/webp" {
			return errors.New("cover mimeType must be image/jpeg, image/png or image/webp")
		}
	default:
		return errors.New("slot must be icon or cover")
	}
	return nil
}

func systemItemMediaKey(itemID int64, slot, mimeType string, data []byte) string {
	extension := map[string]string{
		"image/jpeg": "jpg",
		"image/png":  "png",
		"image/webp": "webp",
	}[mimeType]
	digest := sha256.Sum256(data)
	return fmt.Sprintf("system-item-media/v1/items/%d/%s/%x.%s", itemID, slot, digest, extension)
}
