package web

import (
	"context"
	"net/http/httptest"
	"testing"
)

func TestOptionalUserPtrCarriesHandlerOwnershipScope(t *testing.T) {
	anonymous := httptest.NewRequest("GET", "/api/items/by-ids?ids=1", nil)
	if got := optionalUserPtr(anonymous); got != nil {
		t.Fatalf("anonymous request unexpectedly got owner %d", *got)
	}

	authenticated := anonymous.WithContext(context.WithValue(anonymous.Context(), userIDKey, int64(44)))
	got := optionalUserPtr(authenticated)
	if got == nil || *got != 44 {
		t.Fatalf("authenticated request lost ownership scope: %v", got)
	}
}
