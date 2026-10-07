package web

import (
	"encoding/base64"
	"testing"
)

func TestTransparentMapPreviewPixels(t *testing.T) {
	cases := []struct {
		name, encoded string
		valid         bool
	}{
		{"transparent corners and visible model", "UklGRiAAAABXRUJQVlA4TBQAAAAvB8ABEA8wbhM5RvMf8BieiP4HDw==", true},
		{"opaque studio backdrop", "UklGRh4AAABXRUJQVlA4TBEAAAAvB8ABAAdQt0bWqP+BiOh/AAA=", false},
		{"empty alpha image", "UklGRhoAAABXRUJQVlA4TA0AAAAvB8ABEAcQERGIiP4HAA==", false},
		{"invalid file", "bm90LWEtV2ViUA==", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			data, err := base64.StdEncoding.DecodeString(c.encoded)
			if err != nil {
				t.Fatal(err)
			}
			err = transparentMapPreview(data)
			if (err == nil) != c.valid {
				t.Fatalf("unexpected preview validation: %v", err)
			}
		})
	}
}
