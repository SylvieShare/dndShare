package web

import (
	"encoding/binary"
	"testing"
)

func pngIconHeader(width, height uint32) []byte {
	data := make([]byte, 24)
	copy(data, []byte("\x89PNG\r\n\x1a\n"))
	binary.BigEndian.PutUint32(data[16:20], width)
	binary.BigEndian.PutUint32(data[20:24], height)
	return data
}

func webpExtendedIconHeader(width, height int) []byte {
	data := make([]byte, 30)
	copy(data[0:4], "RIFF")
	copy(data[8:12], "WEBP")
	copy(data[12:16], "VP8X")
	width--
	height--
	data[24], data[25], data[26] = byte(width), byte(width>>8), byte(width>>16)
	data[27], data[28], data[29] = byte(height), byte(height>>8), byte(height>>16)
	return data
}

func TestCharacterIconDimensionsAllowAtMost256Pixels(t *testing.T) {
	for _, test := range []struct {
		name        string
		data        []byte
		contentType string
		wantError   bool
	}{
		{name: "PNG at limit", data: pngIconHeader(256, 256), contentType: "image/png"},
		{name: "small PNG", data: pngIconHeader(128, 96), contentType: "image/png"},
		{name: "PNG too wide", data: pngIconHeader(257, 256), contentType: "image/png", wantError: true},
		{name: "extended WebP at limit", data: webpExtendedIconHeader(256, 256), contentType: "image/webp"},
		{name: "extended WebP too tall", data: webpExtendedIconHeader(256, 257), contentType: "image/webp", wantError: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			err := validateCharacterIconDimensions(test.data, test.contentType)
			if (err != nil) != test.wantError {
				t.Fatalf("validateCharacterIconDimensions() error = %v, wantError %v", err, test.wantError)
			}
		})
	}
}
