package web

import (
	"dndshare/internal/cyberpunkred"
	"encoding/json"
	"errors"
	"fmt"
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

func TestRedRollLostResponseHTTPPostgres(t *testing.T) {
	f := newAuthHTTPFixture(t)
	ctx := t.Context()
	// This fixture seeds explicit D&D IDs; advance only its local sequences.
	_, err := f.pool.Exec(ctx, `SELECT setval(pg_get_serial_sequence('dndshare.source','id'),(SELECT max(id) FROM dndshare.source)); SELECT setval(pg_get_serial_sequence('dndshare.source_version','id'),(SELECT max(id) FROM dndshare.source_version))`)
	if err != nil {
		t.Fatal(err)
	}
	installed, err := f.store.InstallRedCatalogue(ctx, cyberpunkred.CoreHash(), true)
	if err != nil {
		t.Fatal(err)
	}
	owner := authClient(t)
	gm := authClient(t)
	stranger := authClient(t)
	for _, row := range []struct {
		client *http.Client
		login  string
	}{{owner, "red-hero"}, {gm, "red-master"}, {stranger, "red-stranger"}} {
		f.request(row.client, "POST", "/api/user/registration", `{"login":"`+row.login+`","password":"test-password"}`, 200)
	}
	raw := json.RawMessage(`{"system":"cyberpunk-red","schemaVersion":1,"values":{"identity":{"handle":"HTTP RED"},"stats":{"INT":6,"REF":8,"DEX":6,"TECH":6,"COOL":6,"WILL":6,"LUCK":5,"MOVE":6,"BODY":6,"EMP":6},"health":{"current":40,"deathSavePenalty":0},"humanity":{"current":60},"luck":{"current":5},"skills":[{"uid":"hg","key":"handgun","rank":6}],"roles":[{"uid":"solo","key":"solo","rank":4}],"inventory":{"entries":[{"uid":"gun","key":"weapon-heavy-pistol","equipped":true,"loaded":2},{"uid":"armor","key":"armor-light-armorjack-body","equipped":true,"ablation":{"body":0}}]},"netrunning":{},"cyberware":{"installations":[]}}}`)
	body, _ := json.Marshal(map[string]any{"templateId": installed.TemplateID, "sourceVersionId": installed.VersionID, "data": raw})
	created, _ := f.request(owner, "POST", "/api/chars", string(body), 200)
	uuid, _ := created["uuid"].(string)
	if uuid == "" {
		t.Fatal(created)
	}
	char, err := f.store.GetCharacter(ctx, uuid)
	if err != nil {
		t.Fatal(err)
	}
	_, err = f.pool.Exec(ctx, `INSERT INTO dndshare.session(id,uuid,owner_user_id,name,system_id,source_version_id,invite_code) VALUES(10,'62000000-0000-4000-8000-000000000010',(SELECT id FROM dndshare.users WHERE login='red-master'),'RED HTTP',$1,$2,'RED-HTTP')`, installed.SourceID, installed.VersionID)
	if err == nil {
		_, err = f.pool.Exec(ctx, `INSERT INTO dndshare.session_participant(session_id,char_id,user_id,sort_order) VALUES(10,$1,$2,1)`, char.ID, char.UserID)
	}
	if err != nil {
		t.Fatal(err)
	}
	path := "/api/char/" + uuid + "/red-roll"
	action := "62000000-0000-4000-8000-000000000011"
	payload := fmt.Sprintf(`{"version":%d,"actionId":"%s","sessionUuid":"62000000-0000-4000-8000-000000000010","kind":"attack","entryUid":"gun","title":"Пистолет","luck":1}`, char.Version, action)
	f.request(stranger, "POST", path, payload, 401)
	upstream, _ := url.Parse(f.url)
	proxy := httputil.NewSingleHostReverseProxy(upstream)
	lost := errors.New("lost committed RED response")
	var dropped atomic.Bool
	proxy.ModifyResponse = func(r *http.Response) error {
		if r.StatusCode == 200 && dropped.CompareAndSwap(false, true) {
			return lost
		}
		return nil
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, _ *http.Request, err error) {
		if errors.Is(err, lost) {
			panic(http.ErrAbortHandler)
		}
		http.Error(w, "proxy error", 502)
	}
	link := httptest.NewServer(proxy)
	t.Cleanup(link.Close)
	response, err := owner.Post(link.URL+path, "application/json", strings.NewReader(payload))
	if response != nil {
		response.Body.Close()
		t.Fatal("first reply unexpectedly delivered")
	}
	if !errors.Is(err, io.EOF) || !dropped.Load() {
		t.Fatal(err)
	}
	replay, _ := f.request(owner, "POST", path, payload, 200)
	again, _ := f.request(owner, "POST", path, payload, 200)
	if !reflect.DeepEqual(replay, again) {
		t.Fatal("retry changed receipt")
	}
	var ammo, luck, events, changes int
	err = f.pool.QueryRow(ctx, `SELECT (data#>>'{values,inventory,entries,0,loaded}')::int,(data#>>'{values,luck,current}')::int,(SELECT count(*) FROM dndshare.session_event WHERE session_id=10),(SELECT count(*) FROM dndshare.character_change WHERE char_id=$1 AND mutation_id=$2::uuid) FROM dndshare."char" WHERE id=$1`, char.ID, action).Scan(&ammo, &luck, &events, &changes)
	if err != nil || ammo != 1 || luck != 4 || events != 1 || changes != 1 {
		t.Fatal(ammo, luck, events, changes, err)
	}
	gmPayload := fmt.Sprintf(`{"version":%d,"actionId":"62000000-0000-4000-8000-000000000012","sessionUuid":"62000000-0000-4000-8000-000000000010","kind":"initiative","title":"Инициатива"}`, char.Version+1)
	f.request(gm, "POST", path, gmPayload, 200)

	impactPayload := fmt.Sprintf(`{"clientActionId":"62000000-0000-4000-8000-000000000013","amount":20,"targets":[{"target":{"kind":"character","charUuid":"%s"}}]}`, uuid)
	firstImpact, _ := f.request(gm, "POST", "/api/sessions/62000000-0000-4000-8000-000000000010/impacts", impactPayload, 200)
	replayImpact, _ := f.request(gm, "POST", "/api/sessions/62000000-0000-4000-8000-000000000010/impacts", impactPayload, 200)
	if !reflect.DeepEqual(firstImpact["event"], replayImpact["event"]) {
		t.Fatal("damage retry changed event")
	}
	var hp, ablation int
	var hasDNDHP bool
	err = f.pool.QueryRow(ctx, `SELECT (data#>>'{values,health,current}')::int,(data#>>'{values,inventory,entries,1,ablation,body}')::int,(data->'values')?'hp' FROM dndshare."char" WHERE id=$1`, char.ID).Scan(&hp, &ablation, &hasDNDHP)
	if err != nil || hp != 31 || ablation != 1 || hasDNDHP {
		t.Fatal(hp, ablation, hasDNDHP, err)
	}
}
