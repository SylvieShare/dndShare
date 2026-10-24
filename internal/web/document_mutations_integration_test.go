package web

import (
	"bytes"
	"context"
	"dndshare/internal/battlemap"
	"dndshare/internal/config"
	"dndshare/internal/documentsync"
	"dndshare/internal/store"
	"dndshare/internal/testdb"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

const documentTestSession = "61000000-0000-4000-8000-000000000010"
const documentTestCharacter = "61000000-0000-4000-8000-000000000001"

func TestDocumentMutationsPostgres(t *testing.T) {
	pool := testdb.Pool(t)
	ctx := context.Background()
	dsn := pool.Config().ConnString()
	var err error
	exec := func(sql string) {
		t.Helper()
		if _, err := pool.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	exec(`DROP SCHEMA IF EXISTS dndshare CASCADE`)
	defer exec(`DROP SCHEMA IF EXISTS dndshare CASCADE`)
	st, err := store.Open(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer st.Close()
	exec(`INSERT INTO dndshare.source(id,name) VALUES(1,'DND5e');
 INSERT INTO dndshare.source_version(id,source_id,version) VALUES(1,1,'2014');
 INSERT INTO dndshare.users(id,login,password,source_version_id) VALUES(1,'Owner','test',1),(2,'DM','test',1),(3,'Player','test',1);
 INSERT INTO dndshare.char_template(id,name) OVERRIDING SYSTEM VALUE VALUES(1,'DND5');
 INSERT INTO dndshare."char"(id,uuid,user_id,template_id,source_version_id,data,public_visible) VALUES
 (1,'61000000-0000-4000-8000-000000000001',1,1,1,'{"values":{"name":"Hero","hp":{"current":10}}}',true),
 (2,'61000000-0000-4000-8000-000000000002',3,1,1,'{"values":{"name":"Other","hp":{"current":20}}}',false);
 INSERT INTO dndshare.session(id,uuid,owner_user_id,name,system_id,source_version_id,invite_code) VALUES(10,'61000000-0000-4000-8000-000000000010',2,'Session',1,1,'DOC-TEST');
 INSERT INTO dndshare.session_participant(id,session_id,char_id,user_id,sort_order) VALUES(1,10,1,1,1),(2,10,2,3,2);`)
	server := New(config.Config{}, st, nil)
	mux := http.NewServeMux()
	server.routesCharacterMutations(mux)
	server.routesMapMutations(mux)
	server.routesEncounterMutations(mux)
	server.routesGlobalMaps(mux)
	request := func(user int64, method, path string, body string) *httptest.ResponseRecorder {
		t.Helper()
		r := httptest.NewRequest(method, path, strings.NewReader(body))
		if user > 0 {
			r = r.WithContext(context.WithValue(store.WithDocumentActor(r.Context(), user), userIDKey, user))
		}
		w := httptest.NewRecorder()
		mux.ServeHTTP(w, r)
		return w
	}
	mutation := `{"baseVersion":1,"mutationId":"62000000-0000-4000-8000-000000000001","patches":[{"op":"set","path":["values","hp","current"],"value":9}],"metadata":[{"events":[{"sessionUuid":"` + documentTestSession + `","type":"hp_changed","action":"HP: 9","data":{},"visibility":"public","clientActionId":"63000000-0000-4000-8000-000000000001"}]}]}`
	path := "/api/char/" + documentTestCharacter + "/data"
	first := request(1, "PATCH", path, mutation)
	if first.Code != 200 {
		t.Fatal(first.Code, first.Body.String())
	}
	duplicate := request(1, "PATCH", path, mutation)
	if duplicate.Code != 200 || !bytes.Equal(first.Body.Bytes(), duplicate.Body.Bytes()) {
		t.Fatal("receipt", duplicate.Code, duplicate.Body.String())
	}
	var count int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.character_change`).Scan(&count); err != nil || count != 1 {
		t.Fatal("history duplicated", count, err)
	}
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_event`).Scan(&count); err != nil || count != 1 {
		t.Fatal("chronicle duplicated", count, err)
	}
	if w := request(1, "PATCH", path, strings.Replace(mutation, `"value":9`, `"value":8`, 1)); w.Code != 400 {
		t.Fatal("mutation reused", w.Code, w.Body.String())
	}
	if w := request(3, "PATCH", path, mutation); w.Code != 401 {
		t.Fatal("permission", w.Code, w.Body.String())
	}
	if w := request(1, "PATCH", path, strings.Replace(mutation, "62000000-0000-4000-8000-000000000001", "62000000-0000-4000-8000-000000000002", 1)); w.Code != 409 {
		t.Fatal("stale write", w.Code, w.Body.String())
	}
	changes := request(1, "GET", "/api/char/"+documentTestCharacter+"/changes?after=1", "")
	var update documentsync.Update
	if err := json.Unmarshal(changes.Body.Bytes(), &update); err != nil || update.Version != 2 || len(update.Patches) != 1 || len(update.Data) > 0 {
		t.Fatal("replay", changes.Code, changes.Body.String(), err)
	}
	secret := `{"baseVersion":2,"mutationId":"62000000-0000-4000-8000-000000000003","patches":[{"op":"set","path":["privateNote"],"value":"private-past-value"}]}`
	if w := request(1, "PATCH", path, secret); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	remove := `{"baseVersion":3,"mutationId":"62000000-0000-4000-8000-000000000004","patches":[{"op":"remove","path":["privateNote"]}]}`
	if w := request(1, "PATCH", path, remove); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	public := request(0, "GET", "/api/char/"+documentTestCharacter+"/changes?after=1", "")
	if public.Code != 200 || strings.Contains(public.Body.String(), "private-past-value") || !strings.Contains(public.Body.String(), `"data"`) {
		t.Fatal("public history leak", public.Code, public.Body.String())
	}
	if w := request(0, "GET", "/api/char/"+documentTestCharacter+"/history", ""); w.Code != 401 {
		t.Fatal("public history", w.Code)
	}
	if w := request(2, "GET", "/api/char/"+documentTestCharacter+"/history", ""); w.Code != 200 || !strings.Contains(w.Body.String(), "private-past-value") {
		t.Fatal("DM history", w.Code, w.Body.String())
	}
	t.Run("authorized live roster", func(t *testing.T) { testDocumentLiveRoster(t, server) })
	t.Run("chronicle commit order", func(t *testing.T) {
		projection := sessionLiveProjection{}
		if _, err := projection.chronicle(ctx, server, 10, 2); err != nil {
			t.Fatal(err)
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			t.Fatal(err)
		}
		defer tx.Rollback(ctx)
		var lower int64
		if err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_event(session_id,author_user_id,event_type,action,data,visibility) VALUES(10,2,'dice_roll','Delayed','{}','public') RETURNING id`).Scan(&lower); err != nil {
			t.Fatal(err)
		}
		exec(`INSERT INTO dndshare.session_event(session_id,author_user_id,event_type,action,data,visibility) VALUES(10,2,'dice_roll','Earlier commit','{}','public')`)
		first, err := projection.chronicle(ctx, server, 10, 2)
		if err != nil || len(first.Events) != 1 || first.Events[0].ID <= lower {
			t.Fatal("later cursor", first, err)
		}
		if err = tx.Commit(ctx); err != nil {
			t.Fatal(err)
		}
		late, err := projection.chronicle(ctx, server, 10, 2)
		if err != nil || len(late.Events) != 1 || late.Events[0].ID != lower {
			t.Fatal("late lower ID was lost", late, err)
		}
		duplicate, err := projection.chronicle(ctx, server, 10, 2)
		if err != nil || len(duplicate.Events) > 0 || len(duplicate.Updates) > 0 {
			t.Fatal("duplicate row", duplicate, err)
		}
	})

	t.Run("character metadata", func(t *testing.T) {
		exec(`INSERT INTO dndshare.source_version(id,source_id,version) VALUES(2,1,'2024')`)
		actor := store.WithDocumentActor(ctx, 1)
		changed, err := st.ChangeCharacterEdition(actor, 1, documentTestCharacter, 4, 2)
		if err != nil || changed.Version != 5 {
			t.Fatal("edition history", changed.Version, err)
		}
		icon, _, err := st.SetCharacterIconImage(actor, 1, 1, "test-icon", "/icon.png", "icon.png", "image/png", 100)
		if err != nil {
			t.Fatal(err)
		}
		detached, err := st.ClearCharacterIconImage(actor, 1, 1)
		if err != nil || detached == nil || *detached != icon {
			t.Fatal("icon history", detached, err)
		}
		w := request(1, "GET", "/api/char/"+documentTestCharacter+"/changes?after=4", "")
		var response documentsync.Update
		if err = json.Unmarshal(w.Body.Bytes(), &response); err != nil || w.Code != 200 || response.Version != 7 || len(response.Patches) != 0 || len(response.Data) > 0 {
			t.Fatal("metadata replay", w.Code, w.Body.String(), err)
		}
		history, err := st.CharacterHistory(ctx, 1, 0)
		if err != nil || len(history) != 6 || history[0].CreatedAt.IsZero() {
			t.Fatal("metadata records", len(history), err)
		}
	})

	t.Run("maps", func(t *testing.T) {
		doc := battlemap.Document{Version: 2, Kind: "tiles", Width: 10, Height: 10, Sun: battlemap.DefaultSun()}
		mapRecord, err := st.SaveBattleMap(ctx, 1, store.BattleMap{Name: "Map", Document: doc})
		if err != nil {
			t.Fatal(err)
		}
		packet := `{"baseVersion":1,"mutationId":"64000000-0000-4000-8000-000000000001","patches":[{"op":"set","path":["name"],"value":"Changed"}]}`
		path := "/api/maps/" + mapRecord.ID
		result := request(1, "PATCH", path, packet)
		if result.Code != 200 {
			t.Fatal(result.Code, result.Body.String())
		}
		if w := request(1, "PATCH", path, packet); w.Code != 200 {
			t.Fatal("retry map", w.Code, w.Body.String())
		}
		if w := request(3, "PATCH", path, packet); w.Code != 404 {
			t.Fatal("private map", w.Code, w.Body.String())
		}
		replay := request(1, "GET", path+"/changes?after=1", "")
		if replay.Code != 200 || !strings.Contains(replay.Body.String(), "Changed") || strings.Contains(replay.Body.String(), `"data"`) {
			t.Fatal("map replay", replay.Code, replay.Body.String())
		}
		documentUpdates = documentsync.New()
		fallback := request(1, "GET", path+"/changes?after=1", "")
		if fallback.Code != 200 || !strings.Contains(fallback.Body.String(), `"data"`) {
			t.Fatal("map snapshot", fallback.Code, fallback.Body.String())
		}
	})
	t.Run("session map", func(t *testing.T) {
		doc := battlemap.Document{Version: 2, Kind: "tiles", Width: 10, Height: 10, Sun: battlemap.DefaultSun()}
		source, err := st.SaveBattleMap(ctx, 2, store.BattleMap{Name: "Session source", Document: doc})
		if err != nil {
			t.Fatal(err)
		}
		current, err := st.AddSessionMap(ctx, 10, source)
		if err != nil {
			t.Fatal(err)
		}
		packet := `{"baseVersion":1,"mutationId":"66000000-0000-4000-8000-000000000001","patches":[{"op":"set","path":["name"],"value":"Session changed"}]}`
		path := "/api/sessions/" + documentTestSession + "/maps/" + current.ID
		if w := request(2, "PATCH", path, packet); w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
		if w := request(2, "PATCH", path, packet); w.Code != 200 {
			t.Fatal("retry", w.Code, w.Body.String())
		}
		if w := request(1, "PATCH", path, packet); w.Code != 401 {
			t.Fatal("permission", w.Code, w.Body.String())
		}
	})
	t.Run("world map", func(t *testing.T) {
		exec(`INSERT INTO dndshare.storage_image(id,user_id,key,url,type) VALUES(100,2,'world','/world.png','image')`)
		current, err := st.CreateGlobalMap(ctx, 10, 2, 100, "World")
		if err != nil {
			t.Fatal(err)
		}
		packet := `{"baseVersion":1,"mutationId":"67000000-0000-4000-8000-000000000001","patches":[{"op":"set","path":["name"],"value":"World changed"}]}`
		path := "/api/sessions/" + documentTestSession + "/global-maps/" + current.ID
		if w := request(2, "PATCH", path, packet); w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
		if w := request(2, "PATCH", path, packet); w.Code != 200 {
			t.Fatal("retry", w.Code, w.Body.String())
		}
		if w := request(1, "PATCH", path, packet); w.Code != 401 {
			t.Fatal("permission", w.Code, w.Body.String())
		}
	})

	t.Run("encounter", func(t *testing.T) {
		path := "/api/sessions/" + documentTestSession + "/encounter"
		packet := `{"baseVersion":0,"mutationId":"65000000-0000-4000-8000-000000000001","patches":[{"op":"set","path":["round"],"value":1},{"op":"set","path":["active"],"value":true}]}`
		if w := request(2, "PATCH", path, packet); w.Code != 200 {
			t.Fatal(w.Code, w.Body.String())
		}
		if w := request(2, "PATCH", path, packet); w.Code != 200 {
			t.Fatal("retry encounter", w.Code, w.Body.String())
		}
		if w := request(1, "PATCH", path, packet); w.Code != 403 {
			t.Fatal("encounter permission", w.Code, w.Body.String())
		}
		if err := pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.session_event WHERE event_type='encounter_started'`).Scan(&count); err != nil || count != 1 {
			t.Fatal("duplicated start event", count, err)
		}
		var visible bool
		if err := pool.QueryRow(ctx, `SELECT visible FROM dndshare.session_presentation_state WHERE session_id=10`).Scan(&visible); err != nil || !visible {
			t.Fatal("presentation not committed", visible, err)
		}
		data, version, err := st.EncounterDocument(ctx, 10)
		if err != nil || version != 1 || !strings.Contains(string(data), `"round":1`) {
			t.Fatal(version, string(data), err)
		}
	})
}
func testDocumentLiveRoster(t *testing.T, s *Server) {
	ctx := context.Background()
	session, err := s.store.GetGameSessionByUUID(ctx, documentTestSession)
	if err != nil {
		t.Fatal(err)
	}
	projection := sessionLiveProjection{}
	initial, err := projection.participants(ctx, s, session, 3)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(initial.Data), `"current":9`) {
		t.Fatal("hidden HP in player projection", string(initial.Data))
	}
	session.Settings.Players.SeeHP = true
	next, err := projection.participants(ctx, s, session, 3)
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(next)
	if !strings.Contains(string(encoded), `"idField":"charId"`) || !strings.Contains(string(encoded), `"current":9`) {
		t.Fatal("roster did not use authorized stable-ID deltas", string(encoded))
	}
	session.Settings.Players.SeeHP = false
	hidden, err := projection.participants(ctx, s, session, 3)
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ = json.Marshal(hidden)
	if strings.Contains(string(encoded), `"current":9`) {
		t.Fatal("old values leaked in removal", string(encoded))
	}
}
