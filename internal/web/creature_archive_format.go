package web

import (
	"archive/tar"
	"bufio"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"path"
	"regexp"
	"strings"
)

const maxCreatureArchive = int64(512 << 20)
const maxCreatureArchiveExpanded = int64(2 << 30)

type creatureArchiveSpec struct {
	ItemID  int64  `json:"itemId"`
	ModelID string `json:"modelId"`
	Stage   string `json:"stage"`
	SHA256  string `json:"sha256"`
	Size    int64  `json:"size"`
}
type creatureArchiveFile struct {
	Path   string `json:"path"`
	Size   int64  `json:"size"`
	SHA256 string `json:"sha256"`
}
type creatureArchiveManifest struct {
	Schema         int                   `json:"schema"`
	ItemID         int64                 `json:"itemId"`
	ModelID        string                `json:"modelId"`
	Stage          string                `json:"stage"`
	WorkflowCommit string                `json:"workflowCommit"`
	WorkflowDirty  bool                  `json:"workflowDirty,omitempty"`
	Files          []creatureArchiveFile `json:"files"`
}

var archivePath = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,199}$`)

func validArchivePath(name string) bool {
	if name == "archive-manifest.json" {
		return false
	}
	if !archivePath.MatchString(name) || path.Clean(name) != name || strings.Contains(name, "..") {
		return false
	}
	for _, part := range strings.Split(name, "/") {
		if strings.HasPrefix(part, ".") {
			return false
		}
	}
	switch path.Ext(name) {
	case ".glb", ".blend", ".png", ".jpg", ".webp", ".json", ".txt", ".py", ".mjs", ".md":
		return true
	}
	return false
}

func validateCreatureArchive(source io.Reader, spec creatureArchiveSpec) (creatureArchiveManifest, error) {
	var manifest creatureArchiveManifest
	hash := sha256.New()
	limited := &io.LimitedReader{R: source, N: spec.Size + 1}
	buffered := bufio.NewReader(io.TeeReader(limited, hash))
	compressed, err := gzip.NewReader(buffered)
	if err != nil {
		return manifest, err
	}
	defer compressed.Close()
	compressed.Multistream(false)
	expanded := &io.LimitedReader{R: compressed, N: maxCreatureArchiveExpanded + 1}
	reader := tar.NewReader(expanded)
	header, err := reader.Next()
	if err != nil {
		return manifest, err
	}
	if header.Name != "archive-manifest.json" || header.Typeflag != tar.TypeReg || header.Size > 256<<10 {
		return manifest, errors.New("archive manifest must be the first regular file")
	}
	data, err := io.ReadAll(reader)
	if err != nil {
		return manifest, err
	}
	if json.Unmarshal(data, &manifest) != nil || manifest.Schema != 1 || manifest.ItemID != spec.ItemID || manifest.ModelID != spec.ModelID || manifest.Stage != spec.Stage || len(manifest.Files) == 0 || len(manifest.Files) > 256 {
		return manifest, errors.New("archive manifest identity or file count differs")
	}
	files := map[string]creatureArchiveFile{}
	for _, file := range manifest.Files {
		if !validArchivePath(file.Path) || !mapSHA.MatchString(file.SHA256) || file.Size < 0 || file.Size > maxCreatureArchive {
			return manifest, errors.New("invalid archive file metadata")
		}
		if _, exists := files[file.Path]; exists {
			return manifest, errors.New("duplicate archive path")
		}
		files[file.Path] = file
	}
	for _, required := range []string{"recipe.json", "inputs/miniature-reference.png", "native/generated-original.glb"} {
		if _, ok := files[required]; !ok {
			return manifest, errors.New("archive is missing a required source")
		}
	}
	if spec.Stage == "ready" {
		for _, required := range []string{"baked/model.blend", "final/model.glb", "final/model-lod.glb", "final/verification.json", "final/lod-silhouette.json"} {
			if _, ok := files[required]; !ok {
				return manifest, errors.New("ready archive is missing a working source")
			}
		}
	}
	for {
		header, err = reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return manifest, err
		}
		file, exists := files[header.Name]
		if !exists || header.Typeflag != tar.TypeReg || header.Size != file.Size {
			return manifest, errors.New("archive contains an unexpected file or link")
		}
		fileHash := sha256.New()
		if _, err = io.Copy(fileHash, reader); err != nil {
			return manifest, err
		}
		if hex.EncodeToString(fileHash.Sum(nil)) != file.SHA256 {
			return manifest, errors.New("archive file checksum mismatch")
		}
		delete(files, header.Name)
	}
	if len(files) != 0 {
		return manifest, errors.New("archive is incomplete")
	}
	padding, err := io.ReadAll(io.LimitReader(expanded, 65537))
	if err != nil {
		return manifest, err
	}
	if len(padding) > 65536 || strings.Trim(string(padding), "\x00") != "" || expanded.N <= 0 {
		return manifest, errors.New("unexpected archive tail or expanded size")
	}
	if _, err = buffered.Peek(1); err != io.EOF {
		return manifest, errors.New("trailing compressed data")
	}
	if spec.Size+1-limited.N != spec.Size || hex.EncodeToString(hash.Sum(nil)) != spec.SHA256 {
		return manifest, errors.New("archive byte size or checksum mismatch")
	}
	return manifest, nil
}
