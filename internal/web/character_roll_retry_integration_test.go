package web

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"net/url"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
)

func TestStatusSaveLostResponsePostgres(t *testing.T) {
	f := newAuthHTTPFixture(t)
	owner := authClient(t)
	f.request(owner, "POST", "/api/user/registration", `{"login":"hero","password":"test-hero-pass"}`, 200)
	f.request(authClient(t), "POST", "/api/user/registration", `{"login":"master","password":"test-master-pass"}`, 200)
	_, err := f.pool.Exec(t.Context(), `
INSERT INTO dndshare.char_template(id,name) OVERRIDING SYSTEM VALUE VALUES(1,'DND5');
INSERT INTO dndshare.item_type(id,name,source_id,fields) VALUES(15,'Эффекты',1,'[]');
INSERT INTO dndshare.item(id,type_id,name,data) VALUES
 (21,15,'Яд','{"repeat_save":{"ability":3,"dc":12,"timing":"turn_end"}}'), (22,15,'Защита','{}');
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status) VALUES(21,1,'native'),(22,1,'native');
INSERT INTO dndshare."char"(id,uuid,user_id,template_id,source_version_id,data)
VALUES(1,'61000000-0000-4000-8000-000000000001',(SELECT id FROM dndshare.users WHERE login='hero'),1,1,
       '{"values":{"name":"Герой","states":[{"uid":"poison","effect_id":21,"params":{"save_dc":12}},{"uid":"ward","effect_id":22}]}}');
INSERT INTO dndshare.session(id,uuid,owner_user_id,name,system_id,source_version_id,invite_code)
VALUES(10,'61000000-0000-4000-8000-000000000010',(SELECT id FROM dndshare.users WHERE login='master'),'Test',1,1,'SAVE-RETRY');
INSERT INTO dndshare.session_participant(session_id,char_id,user_id,sort_order)
SELECT 10,1,id,1 FROM dndshare.users WHERE login='hero';`)
	if err != nil {
		t.Fatal(err)
	}

	const path = "/api/char/61000000-0000-4000-8000-000000000001/dice-roll"
	const action = "99200000-0000-4000-8000-000000000010"
	const payload = `{"version":1,"clientActionId":"` + action + `","sessionUuid":"61000000-0000-4000-8000-000000000010",
	"prepared":{"request":{"title":"Повторный спасбросок","kind":"saving_throw","ability":3},"mode":"normal","flat":20},
	"statusSave":{"dc":12,"before":[{"uid":"poison","effect_id":21,"params":{"save_dc":12}},{"uid":"ward","effect_id":22}],"success":[{"uid":"ward","effect_id":22}],"failure":[{"uid":"poison","effect_id":21,"params":{"save_dc":12}},{"uid":"ward","effect_id":22}]}}`

	// Drop the downstream connection only after the real handler has committed and sent HTTP 200.
	upstream, err := url.Parse(f.url)
	if err != nil {
		t.Fatal(err)
	}
	proxy := httputil.NewSingleHostReverseProxy(upstream)
	lost := errors.New("drop committed response")
	var dropped atomic.Bool
	proxy.ModifyResponse = func(r *http.Response) error {
		if r.StatusCode == http.StatusOK && dropped.CompareAndSwap(false, true) {
			return lost
		}
		return nil
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
		if errors.Is(err, lost) {
			panic(http.ErrAbortHandler)
		}
		http.Error(w, err.Error(), http.StatusBadGateway)
	}
	link := httptest.NewServer(proxy)
	t.Cleanup(link.Close)
	f.url = link.URL
	res, err := owner.Post(link.URL+path, "application/json", strings.NewReader(payload))
	if res != nil {
		body, _ := io.ReadAll(res.Body)
		res.Body.Close()
		t.Fatalf("first response reached the client: %d %s", res.StatusCode, body)
	}
	if !dropped.Load() || !errors.Is(err, io.EOF) {
		t.Fatalf("expected lost committed response, got %v", err)
	}

	check := func() map[string]any {
		t.Helper()
		var version, events, changes int
		var ended bool
		var raw []byte
		err := f.pool.QueryRow(t.Context(), `SELECT c.version, c.data#>'{values,states}'='[{"uid":"ward","effect_id":22}]'::jsonb,
			(SELECT count(*) FROM dndshare.session_event WHERE session_id=10 AND event_type='dice_roll'),
			(SELECT count(*) FROM dndshare.character_change WHERE char_id=1 AND mutation_id=$1),
			(SELECT metadata->0->'diceReceipt' FROM dndshare.character_change WHERE char_id=1 AND mutation_id=$1)
			FROM dndshare."char" c WHERE c.id=1`, action).Scan(&version, &ended, &events, &changes, &raw)
		if err != nil {
			t.Fatal(err)
		}
		if version != 2 || !ended || events != 1 || changes != 1 {
			t.Fatalf("version=%d poison removed and ward preserved=%t events=%d changes=%d", version, ended, events, changes)
		}
		var receipt map[string]any
		if err := json.Unmarshal(raw, &receipt); err != nil {
			t.Fatal(err)
		}
		return receipt
	}
	first := check()
	replay, _ := f.request(owner, "POST", path, payload, 200)
	if !reflect.DeepEqual(first, replay) || !reflect.DeepEqual(first, check()) {
		t.Fatalf("retry changed the roll or receipt: original=%v replay=%v", first, replay)
	}
}
