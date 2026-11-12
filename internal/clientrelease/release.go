// Package clientrelease exposes immutable, signed web bundles embedded by the release pipeline.
package clientrelease

import (
	"embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io/fs"
)

//go:embed all:updates
var updates embed.FS

type Frontend struct {
	Version       string `json:"version"`
	Build         int64  `json:"build"`
	CommitSHA     string `json:"commitSha"`
	SourceHash    string `json:"sourceHash"`
	NativeRuntime string `json:"nativeRuntime"`
	APIContract   int    `json:"apiContract"`
	DataContract  int    `json:"dataContract"`
}
type Envelope struct {
	Payload   string `json:"payload"`
	Signature string `json:"signature"`
}
type Manifest struct {
	Frontend
	Format        int    `json:"format"`
	ApplicationID string `json:"applicationId"`
	BundleSHA256  string `json:"bundleSha256"`
	BundleBytes   int64  `json:"bundleBytes"`
}

func ParseEnvelope(data []byte) (Envelope, Manifest, error) {
	var envelope Envelope
	var manifest Manifest
	if err := json.Unmarshal(data, &envelope); err != nil {
		return envelope, manifest, err
	}
	payload, err := base64.StdEncoding.DecodeString(envelope.Payload)
	if err != nil {
		return envelope, manifest, err
	}
	if err = json.Unmarshal(payload, &manifest); err != nil {
		return envelope, manifest, err
	}
	if manifest.Format != 1 || manifest.ApplicationID != "ru.dndshare.client" || len(manifest.BundleSHA256) != 64 || envelope.Signature == "" {
		return envelope, manifest, errors.New("invalid embedded frontend release")
	}
	return envelope, manifest, nil
}
func Latest() ([]byte, Manifest, error) {
	data, err := updates.ReadFile("updates/latest.json")
	if err != nil {
		return nil, Manifest{}, err
	}
	_, manifest, err := ParseEnvelope(data)
	return data, manifest, err
}
func OpenBundle(digest string) (fs.File, error) {
	if len(digest) != 64 {
		return nil, fs.ErrNotExist
	}
	for _, char := range digest {
		if !(char >= '0' && char <= '9' || char >= 'a' && char <= 'f') {
			return nil, fs.ErrNotExist
		}
	}
	return updates.Open("updates/" + digest + ".zip")
}
