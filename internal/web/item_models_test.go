package web

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync/atomic"
	"testing"

	"dndshare/internal/battlemap"
	"dndshare/internal/config"
	"dndshare/internal/storage"
	"dndshare/internal/store"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestItemModelRoutesRejectInvalidIDsAndNonVisualAssets(t *testing.T) {
	s := &Server{}
	mux := http.NewServeMux()
	s.routesItemModels(mux)
	for path, status := range map[string]int{
		"/api/items/bad/model": 400, "/api/items/0/model": 400,
		"/api/items/1/model/source": 404, "/api/items/1/model/shadow": 404,
		"/api/items/1/model/preview":     404,
		"/api/items/1/model/base/source": 404, "/api/items/1/model/base/shadow": 404,
	} {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != status {
			t.Fatalf("%s: status %d, want %d", path, w.Code, status)
		}
	}
}

func TestStreamModelAssetCacheAndContent(t *testing.T) {
	data := []byte("glTF fixture")
	hash := sha256.Sum256(data)
	sha := hex.EncodeToString(hash[:])
	asset := battlemap.ModelAsset{Key: "map-models/fixture.glb", SHA256: sha, Size: int64(len(data)), MimeType: "model/gltf-binary"}
	var calls atomic.Int32
	var fail atomic.Bool
	objectServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if fail.Load() {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		if r.URL.Path != "/test/"+asset.Key {
			t.Errorf("unexpected object key: %s", r.URL.Path)
		}
		w.Write(data)
	}))
	defer objectServer.Close()
	s := &Server{s3: storage.New(config.StorageConfig{Endpoint: objectServer.URL, Region: "test", Bucket: "test", AccessKey: "test", SecretKey: "test"})}
	for _, scope := range []string{"public", "private"} {
		w := httptest.NewRecorder()
		s.streamModelAsset(w, httptest.NewRequest("GET", "/model?sha="+sha, nil), asset, scope)
		if w.Code != 200 || !bytes.Equal(w.Body.Bytes(), data) || w.Header().Get("Content-Type") != asset.MimeType || w.Header().Get("Cache-Control") != scope+", max-age=31536000, immutable" {
			t.Fatalf("invalid streamed response: %d %v %s", w.Code, w.Header(), w.Body.String())
		}
	}
	before := calls.Load()
	for _, cached := range []bool{false, true} {
		path := "/model?sha=stale"
		if cached {
			path = "/model?sha=" + sha
		}
		r := httptest.NewRequest("GET", path, nil)
		if cached {
			r.Header.Set("If-None-Match", `"`+sha+`"`)
		}
		w := httptest.NewRecorder()
		s.streamModelAsset(w, r, asset, "public")
		if (cached && w.Code != 304) || (!cached && w.Code != 404) || calls.Load() != before {
			t.Fatalf("stale/cached request touched storage or returned wrong status: %d", w.Code)
		}
	}
	fail.Store(true)
	w := httptest.NewRecorder()
	s.streamModelAsset(w, httptest.NewRequest("GET", "/model?sha="+sha, nil), asset, "public")
	if w.Code != 500 || w.Header().Get("Cache-Control") != "no-store" || w.Header().Get("ETag") != "" {
		t.Fatalf("storage failure must not become immutable in browser cache: %d %v", w.Code, w.Header())
	}
}

func TestPublicItemModelHTTPPostgres(t *testing.T) {
	dsn := os.Getenv("DNDSHARE_ITEM_MODEL_HTTP_TEST_DSN")
	if dsn == "" {
		t.Skip("requires an isolated local dndshare_test_* database")
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	if cfg.ConnConfig.Host != "127.0.0.1" || !strings.HasPrefix(cfg.ConnConfig.Database, "dndshare_test_") {
		t.Fatal("requires an isolated local database")
	}
	pool, err := pgxpool.NewWithConfig(t.Context(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if _, err := pool.Exec(t.Context(), `DROP SCHEMA IF EXISTS dndshare CASCADE`); err != nil {
		t.Fatal(err)
	}
	st, err := store.Open(t.Context(), dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	_, err = pool.Exec(t.Context(), `INSERT INTO dndshare.source(id,name) VALUES(1,'Test');
 INSERT INTO dndshare.source_version(id,source_id,version) VALUES(1,1,'2014');
 INSERT INTO dndshare.users(id,login,password,source_version_id) VALUES(1,'test','test',1);
 INSERT INTO dndshare.item_type(id,name,source_id,fields) VALUES(6,'Creatures',1,'[]');
 INSERT INTO dndshare.item(id,type_id,name,data) VALUES(1635,6,'Kobold','{}'),(1636,6,'Hidden','{}'),(1637,6,'Private','{}'),(1638,6,'Unbound','{}');`)
	if err != nil {
		t.Fatal(err)
	}
	model := battlemap.InitialCatalogue()[0]
	model.TileType, model.Category, model.Hidden = "object", "object", true
	if _, err = st.RegisterMapModel(t.Context(), model); err != nil {
		t.Fatal(err)
	}
	for _, id := range []int64{1635, 1636, 1637} {
		if err = st.BindItemModel(t.Context(), store.ItemModelBinding{ItemID: id, ModelID: model.ID, Default: true}); err != nil {
			t.Fatal(err)
		}
	}
	_, err = pool.Exec(t.Context(), `UPDATE dndshare.item SET hidden=true WHERE id=1636; UPDATE dndshare.item SET user_id=1,custom_source_id=(SELECT id FROM dndshare.custom_item_source WHERE user_id=1 AND is_default LIMIT 1) WHERE id=1637;`)
	if err != nil {
		t.Fatal(err)
	}
	s := &Server{store: st}
	mux := http.NewServeMux()
	s.routesItemModels(mux)
	s.routesItems(mux)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/items/1635/model", nil))
	if w.Code != 200 || strings.Contains(w.Body.String(), `"base"`) {
		t.Fatalf("model without a registered base: %d %s", w.Code, w.Body.String())
	}
	var selectedBase battlemap.Model
	for index, size := range []float64{.5, 1, 1} {
		base := model
		base.ID = []string{"92000000-0000-4000-8000-000000000001", "92000000-0000-4000-8000-000000000002", "92000000-0000-4000-8000-000000000003"}[index]
		base.SourceCode, base.SourceName = base.ID, base.ID
		base.Category, base.BaseSize, base.SurfaceHeight = "creature-base", size, .06
		base.Width, base.Height = 1, 1
		base.MountDepth, base.MountProfile = 0, ""
		base.PlacementPoints, base.SupportSlots, base.Blockers = nil, nil, nil
		if _, err := st.RegisterMapModel(t.Context(), base); err != nil {
			t.Fatal(err)
		}
		if index == 1 {
			selectedBase = base
		}
	}
	for _, path := range []string{"/api/items/1635/model", "/api/items/by-ids?ids=1635"} {
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 200 {
			t.Fatalf("anonymous %s: %d %s", path, w.Code, w.Body.String())
		}
		if strings.Contains(path, "by-ids") {
			var result struct {
				Items []store.Item `json:"items"`
			}
			if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil || len(result.Items) != 1 || result.Items[0].ModelID != model.ID {
				t.Fatalf("item presence missing: %s %v", w.Body.String(), err)
			}
		} else {
			var result itemModelView
			if err := json.Unmarshal(w.Body.Bytes(), &result); err != nil || result.ID != model.ID || !strings.HasPrefix(result.RenderURL, "/api/items/1635/model/render?sha=") || strings.Contains(w.Body.String(), "sourceUrl") {
				t.Fatalf("invalid public projection: %s %v", w.Body.String(), err)
			}
			if result.Base == nil || result.Base.ID != selectedBase.ID || result.Base.SurfaceHeight != .06 || !strings.HasPrefix(result.Base.RenderURL, "/api/items/1635/model/base/render?sha=") {
				t.Fatalf("invalid deterministic unit base: %s", w.Body.String())
			}
		}
	}
	for _, kind := range []string{"render", "lod"} {
		sha := selectedBase.Assets[kind].SHA256
		r := httptest.NewRequest("GET", "/api/items/1635/model/base/"+kind+"?sha="+sha, nil)
		r.Header.Set("If-None-Match", `"`+sha+`"`)
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		if w.Code != http.StatusNotModified || w.Header().Get("Cache-Control") != "public, max-age=31536000, immutable" {
			t.Fatalf("public base cache: %d %v", w.Code, w.Header())
		}
	}
	for _, id := range []string{"1636", "1637", "1638", "999"} {
		for _, suffix := range []string{"/model", "/model/render", "/model/base/render", "/model/base/lod"} {
			w := httptest.NewRecorder()
			mux.ServeHTTP(w, httptest.NewRequest("GET", "/api/items/"+id+suffix, nil))
			if w.Code != 404 {
				t.Fatalf("private/hidden/unbound item %s leaked: %d", id, w.Code)
			}
		}
	}
}
