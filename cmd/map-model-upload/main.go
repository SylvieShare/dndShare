// map-model-upload uses MCP to authorize direct uploads from this machine to S3.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"dndshare/internal/battlemap"
)

type client struct {
	url, token string
	http       *http.Client
}

func (c client) call(ctx context.Context, name string, args any, out any) error {
	body, err := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": map[string]any{"name": name, "arguments": args}})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", c.url, strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")
	response, err := c.http.Do(req)
	if err != nil {
		return errors.New("MCP connection failed")
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return fmt.Errorf("MCP returned HTTP %d", response.StatusCode)
	}
	var envelope struct {
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
		Result struct {
			IsError bool `json:"isError"`
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
			Structured struct {
				Result json.RawMessage `json:"result"`
			} `json:"structuredContent"`
		} `json:"result"`
	}
	if err = json.NewDecoder(io.LimitReader(response.Body, 4<<20)).Decode(&envelope); err != nil {
		return err
	}
	if envelope.Error != nil {
		return errors.New(envelope.Error.Message)
	}
	if envelope.Result.IsError {
		if len(envelope.Result.Content) > 0 {
			return errors.New(envelope.Result.Content[0].Text)
		}
		return errors.New("MCP tool failed")
	}
	if out != nil {
		return json.Unmarshal(envelope.Result.Structured.Result, out)
	}
	return nil
}

func main() {
	dir := flag.String("assets", ".", "Folder with content-addressed assets and catalogue.json")
	endpoint := flag.String("mcp-url", "https://dndshare.ru/mcp", "MCP endpoint")
	flag.Parse()
	token := os.Getenv("MCP_AUTH_TOKEN")
	if token == "" {
		log.Fatal("MCP_AUTH_TOKEN is required")
	}
	parsed, err := url.Parse(*endpoint)
	if err != nil || parsed.Scheme != "https" {
		log.Fatal("HTTPS MCP endpoint required")
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	raw, err := os.ReadFile(filepath.Join(*dir, "catalogue.json"))
	if err != nil {
		log.Fatal(err)
	}
	var models []battlemap.Model
	if err = json.Unmarshal(raw, &models); err != nil {
		log.Fatal(err)
	}
	c := client{url: *endpoint, token: token, http: &http.Client{Timeout: 10 * time.Minute, CheckRedirect: func(r *http.Request, v []*http.Request) error { return http.ErrUseLastResponse }}}
	for _, m := range models {
		for _, kind := range []string{"preview", "render", "lod", "source"} {
			if err = upload(ctx, c, *dir, kind, m.Assets[kind]); err != nil {
				log.Fatalf("%s %s: %v", m.SourceCode, kind, err)
			}
			log.Printf("uploaded %s %s", m.SourceCode, kind)
		}
		if err = c.call(ctx, "map_tile_model_register", map[string]any{"model": m}, nil); err != nil {
			log.Fatalf("register %s: %v", m.SourceCode, err)
		}
		log.Printf("registered %s", m.SourceCode)
	}
}

func upload(ctx context.Context, c client, dir, kind string, asset battlemap.ModelAsset) error {
	file, err := os.Open(filepath.Join(dir, filepath.Base(asset.Key)))
	if err != nil {
		return err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return err
	}
	if info.Size() != asset.Size {
		return errors.New("local asset size mismatch")
	}
	hash := sha256.New()
	if _, err = io.Copy(hash, file); err != nil {
		return err
	}
	if hex.EncodeToString(hash.Sum(nil)) != asset.SHA256 {
		return errors.New("local asset SHA-256 mismatch")
	}
	if _, err = file.Seek(0, io.SeekStart); err != nil {
		return err
	}
	args := map[string]any{"kind": kind, "fileName": asset.FileName, "sha256": asset.SHA256, "size": asset.Size}
	var prepared struct {
		UploadKey string            `json:"uploadKey"`
		UploadURL string            `json:"uploadUrl"`
		Headers   map[string]string `json:"headers"`
	}
	if err = c.call(ctx, "map_tile_asset_prepare_upload", args, &prepared); err != nil {
		return err
	}
	target, err := url.Parse(prepared.UploadURL)
	if err != nil || target.Scheme != "https" || (target.Hostname() != "storage.yandexcloud.net" && !strings.HasSuffix(target.Hostname(), ".storage.yandexcloud.net")) {
		return errors.New("upload destination is not Yandex Object Storage")
	}
	req, err := http.NewRequestWithContext(ctx, "PUT", prepared.UploadURL, file)
	if err != nil {
		return err
	}
	req.ContentLength = asset.Size
	for name, value := range prepared.Headers {
		req.Header.Set(name, value)
	}
	response, err := c.http.Do(req)
	if err != nil {
		return errors.New("direct S3 upload failed")
	}
	response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("S3 upload returned HTTP %d", response.StatusCode)
	}
	args["uploadKey"] = prepared.UploadKey
	var result battlemap.ModelAsset
	if err = c.call(ctx, "map_tile_asset_complete_upload", args, &result); err != nil {
		return err
	}
	if result != asset {
		return errors.New("registered asset differs from local manifest")
	}
	return nil
}
