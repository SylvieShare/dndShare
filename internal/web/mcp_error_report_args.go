package web

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

func normalizeErrorReportCommitSHA(value *string) (*string, error) {
	if value == nil {
		return nil, nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil, nil
	}
	if len(trimmed) < 7 || len(trimmed) > 64 {
		return nil, errors.New("commitSha must contain 7..64 hexadecimal characters")
	}
	for _, char := range trimmed {
		if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f') || (char >= 'A' && char <= 'F')) {
			return nil, errors.New("commitSha must contain 7..64 hexadecimal characters")
		}
	}
	return &trimmed, nil
}

// --- tools/list schema ---

func newErrorReportLeaseID() (string, error) {
	data := make([]byte, 16)
	if _, err := rand.Read(data); err != nil {
		return "", fmt.Errorf("generate error-report lease id: %w", err)
	}
	return hex.EncodeToString(data), nil
}

func errorReportLeaseIDArg(args map[string]json.RawMessage) (string, error) {
	return argString(args, "leaseId")
}
