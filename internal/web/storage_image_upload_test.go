package web

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"
)

func TestImageUploadSizeLimit(t *testing.T) {
	for _, size := range []int64{16 << 20, 30 << 20, (30 << 20) + 1, 32 << 20} {
		t.Run(strconv.FormatInt(size, 10), func(t *testing.T) {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			part, err := writer.CreateFormFile("file", "world.webp")
			if err != nil {
				t.Fatal(err)
			}
			if _, err = io.CopyN(part, &zeroReader{}, size); err != nil {
				t.Fatal(err)
			}
			if err = writer.Close(); err != nil {
				t.Fatal(err)
			}
			r := httptest.NewRequest("POST", "/api/storage/images", &body)
			r.Header.Set("Content-Type", writer.FormDataContentType())
			file, header, err := readImageUpload(httptest.NewRecorder(), r)
			if r.MultipartForm != nil {
				defer r.MultipartForm.RemoveAll()
			}
			if size > 30<<20 {
				if err == nil || err.Error() != "file too large" {
					t.Fatalf("oversized upload: %v", err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			defer file.Close()
			if header.Size != size {
				t.Fatalf("file size = %d, want %d", header.Size, size)
			}
			if _, ok := file.(*os.File); !ok {
				t.Fatal("large image should be spooled to a temporary file")
			}
		})
	}
}

type zeroReader struct{}

func (*zeroReader) Read(p []byte) (int, error) {
	clear(p)
	return len(p), nil
}
