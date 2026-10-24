package web

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"dndshare/internal/config"
)

func archiveFixture(t *testing.T, mutate func(*creatureArchiveManifest, map[string][]byte)) ([]byte, creatureArchiveSpec) {
	t.Helper()
	spec := creatureArchiveSpec{ItemID: 1692, ModelID: "c0000000-0000-4000-8000-000000000001", Stage: "native"}
	files := map[string][]byte{"recipe.json": []byte(`{"referenceDiameter":0.9}`), "inputs/miniature-reference.png": []byte("image"), "native/generated-original.glb": []byte("native mesh")}
	manifest := creatureArchiveManifest{Schema: 1, ItemID: spec.ItemID, ModelID: spec.ModelID, Stage: spec.Stage, Files: []creatureArchiveFile{}}
	for name, data := range files {
		h := sha256.Sum256(data)
		manifest.Files = append(manifest.Files, creatureArchiveFile{Path: name, Size: int64(len(data)), SHA256: hex.EncodeToString(h[:])})
	}
	if mutate != nil {
		mutate(&manifest, files)
	}
	var buffer bytes.Buffer
	gz := gzip.NewWriter(&buffer)
	writer := tar.NewWriter(gz)
	data, _ := json.Marshal(manifest)
	if err := writer.WriteHeader(&tar.Header{Name: "archive-manifest.json", Size: int64(len(data)), Mode: 0644}); err != nil {
		t.Fatal(err)
	}
	writer.Write(data)
	for name, data := range files {
		if err := writer.WriteHeader(&tar.Header{Name: name, Size: int64(len(data)), Mode: 0644}); err != nil {
			t.Fatal(err)
		}
		writer.Write(data)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gz.Close(); err != nil {
		t.Fatal(err)
	}
	data = buffer.Bytes()
	hash := sha256.Sum256(data)
	spec.Size = int64(len(data))
	spec.SHA256 = hex.EncodeToString(hash[:])
	return data, spec
}

func TestCreatureArchiveManifestChecksEverySource(t *testing.T) {
	data, spec := archiveFixture(t, nil)
	manifest, err := validateCreatureArchive(bytes.NewReader(data), spec)
	if err != nil || manifest.ModelID != spec.ModelID || len(manifest.Files) != 3 {
		t.Fatal(manifest, err)
	}
	for name, mutate := range map[string]func(*creatureArchiveManifest, map[string][]byte){
		"wrong item":        func(m *creatureArchiveManifest, _ map[string][]byte) { m.ItemID++ },
		"wrong source hash": func(m *creatureArchiveManifest, _ map[string][]byte) { m.Files[0].SHA256 = strings.Repeat("a", 64) },
		"missing source":    func(_ *creatureArchiveManifest, f map[string][]byte) { delete(f, "native/generated-original.glb") },
		"unexpected source": func(_ *creatureArchiveManifest, f map[string][]byte) { f["credentials.json"] = []byte("unexpected") },
		"traversal":         func(m *creatureArchiveManifest, _ map[string][]byte) { m.Files[0].Path = "../outside.txt" },
		"duplicate file":    func(m *creatureArchiveManifest, _ map[string][]byte) { m.Files = append(m.Files, m.Files[0]) },
		"expanded limit":    func(m *creatureArchiveManifest, _ map[string][]byte) { m.Files[0].Size = maxCreatureArchive + 1 },
		"unfinished ready":  func(m *creatureArchiveManifest, _ map[string][]byte) { m.Stage = "ready" },
	} {
		t.Run(name, func(t *testing.T) {
			body, want := archiveFixture(t, mutate)
			if name == "unfinished ready" {
				want.Stage = "ready"
			}
			if _, err := validateCreatureArchive(bytes.NewReader(body), want); err == nil {
				t.Fatal("accepted invalid archive")
			}
		})
	}
	spec.SHA256 = strings.Repeat("b", 64)
	if _, err := validateCreatureArchive(bytes.NewReader(data), spec); err == nil {
		t.Fatal("accepted wrong compressed checksum")
	}
}

func TestCreatureArchivePathsAndWriteGate(t *testing.T) {
	for _, name := range []string{"../key.txt", "/outside.json", "inputs/.env", "inputs/../secret.json", "key.pem", "archive-manifest.json", "a\\b.json"} {
		if validArchivePath(name) {
			t.Fatal("accepted unsafe archive path", name)
		}
	}
	s := &Server{cfg: config.Config{MCPWriteEnabled: false}}
	for _, name := range []string{"creature_model_archive_prepare_upload", "creature_model_archive_complete_upload"} {
		if _, err := s.dispatchTool(httptest.NewRequest("POST", "/mcp", nil), name, map[string]json.RawMessage{}); err == nil || !strings.Contains(err.Error(), "disabled") {
			t.Fatal(name, err)
		}
	}
	data, spec := archiveFixture(t, nil)
	_ = data
	args := map[string]json.RawMessage{}
	for k, v := range map[string]any{"itemId": spec.ItemID, "modelId": spec.ModelID, "stage": spec.Stage, "sha256": spec.SHA256, "size": spec.Size} {
		args[k], _ = json.Marshal(v)
	}
	if _, err := creatureArchiveArguments(args); err != nil {
		t.Fatal(err)
	}
	args["stage"] = json.RawMessage(`"../private"`)
	if _, err := creatureArchiveArguments(args); err == nil {
		t.Fatal("accepted invalid archive stage")
	}
}
