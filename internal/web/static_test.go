package web

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http/httptest"
	"strings"
	"testing"
	"testing/fstest"
)

func TestSPAReleaseAssets(t *testing.T) {
	var encoded bytes.Buffer
	writer := gzip.NewWriter(&encoded)
	_, _ = writer.Write([]byte("old chunk"))
	_ = writer.Close()
	current := fstest.MapFS{"index.html": {Data: []byte("new HTML")}, "static/current-abc.js": {Data: []byte("new chunk")}}
	retained := fstest.MapFS{
		"static/previous-def.js":    {Data: []byte("old chunk")},
		"static/previous-def.js.gz": {Data: encoded.Bytes()},
		"static/current-abc.js":     {Data: []byte("incorrect archive copy")},
		"index.html":                {Data: []byte("old HTML")}, "private.txt": {Data: []byte("not an asset")},
	}
	handler := newSPAHandler(current, retained)
	for _, test := range []struct {
		url, encoding, body string
		status              int
		compressed          bool
	}{
		{"/", "", "new HTML", 200, false},
		{"/char/example", "", "new HTML", 200, false},
		{"/index.html", "", "new HTML", 200, false},
		{"/static/current-abc.js", "gzip", "new chunk", 200, false},
		{"/static/previous-def.js", "", "old chunk", 200, false},
		{"/static/previous-def.js", "br, gzip", "old chunk", 200, true},
		{"/static/previous-def.js", "gzip;q=0.0", "old chunk", 200, false},
		{"/static/missing.js", "", "", 404, false},
		{"/private.txt", "", "", 404, false},
		{"/static/../private.txt", "", "", 404, false},
	} {
		t.Run(test.url+test.encoding, func(t *testing.T) {
			request := httptest.NewRequest("GET", test.url, nil)
			request.Header.Set("Accept-Encoding", test.encoding)
			response := httptest.NewRecorder()
			handler.ServeHTTP(response, request)
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d", response.Code, test.status)
			}
			if test.status != 200 {
				return
			}
			body := response.Body.Bytes()
			if test.compressed {
				if response.Header().Get("Content-Encoding") != "gzip" {
					t.Fatal("missing gzip header")
				}
				reader, err := gzip.NewReader(bytes.NewReader(body))
				if err != nil {
					t.Fatal(err)
				}
				body, _ = io.ReadAll(reader)
				_ = reader.Close()
				if !strings.Contains(response.Header().Get("Content-Type"), "javascript") {
					t.Fatal("wrong compressed MIME")
				}
			} else if response.Header().Get("Content-Encoding") != "" {
				t.Fatal("unexpected compression")
			}
			if string(body) != test.body {
				t.Fatalf("body = %q, want %q", body, test.body)
			}
			cache := response.Header().Get("Cache-Control")
			if strings.HasPrefix(test.url, "/static/") && !strings.Contains(cache, "immutable") {
				t.Fatal("asset is not immutable")
			}
			if !strings.HasPrefix(test.url, "/static/") && cache != "no-cache" {
				t.Fatal("HTML may be stale")
			}
		})
	}
}
