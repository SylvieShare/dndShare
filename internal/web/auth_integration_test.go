package web

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strings"
	"testing"

	"dndshare/internal/config"
	"dndshare/internal/store"
	"dndshare/internal/testdb"
	"github.com/jackc/pgx/v5/pgxpool"
)

type authHTTPFixture struct {
	t     *testing.T
	url   string
	pool  *pgxpool.Pool
	store *store.Store
}

func newAuthHTTPFixture(t *testing.T) authHTTPFixture {
	t.Helper()
	pool := testdb.Pool(t)
	st, err := store.Open(t.Context(), pool.Config().ConnString())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(st.Close)
	if _, err := pool.Exec(t.Context(), `INSERT INTO dndshare.source(id,name) VALUES(1,'DND5e');
 INSERT INTO dndshare.source_version(id,source_id,version) VALUES(1,1,'2014')`); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(New(config.Config{SecureCookie: "false"}, st, nil).Handler())
	t.Cleanup(server.Close)
	return authHTTPFixture{t: t, url: server.URL, pool: pool, store: st}
}

func authClient(t *testing.T) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	return &http.Client{Jar: jar}
}

func (f authHTTPFixture) request(client *http.Client, method, path, body string, want int) (map[string]any, *http.Response) {
	f.t.Helper()
	r, err := http.NewRequest(method, f.url+path, strings.NewReader(body))
	if err != nil {
		f.t.Fatal(err)
	}
	r.Header.Set("Content-Type", "application/json")
	response, err := client.Do(r)
	if err != nil {
		f.t.Fatal(err)
	}
	defer response.Body.Close()
	data, err := io.ReadAll(response.Body)
	if err != nil {
		f.t.Fatal(err)
	}
	if response.StatusCode != want {
		f.t.Fatalf("%s %s: %d, want %d: %s", method, path, response.StatusCode, want, data)
	}
	var value map[string]any
	if len(data) > 0 && string(data) != "null\n" && string(data) != "null" {
		if err := json.Unmarshal(data, &value); err != nil {
			f.t.Fatal(err)
		}
	}
	return value, response
}

func (f authHTTPFixture) authenticated(client *http.Client, want bool) {
	f.t.Helper()
	body, _ := f.request(client, "GET", "/api/user/checkAuth", "", 200)
	if body["auth"] != want {
		f.t.Fatalf("auth = %v, want %v: %+v", body["auth"], want, body)
	}
	if want {
		user := body["user"].(map[string]any)
		if user["login"] != "tester" || user["password"] != nil || len(user["roles"].([]any)) != 0 {
			f.t.Fatalf("public account projection: %+v", user)
		}
	}
}

func TestAuthHTTPRegistrationLoginAndLogout(t *testing.T) {
	f := newAuthHTTPFixture(t)
	client := authClient(t)
	f.authenticated(client, false)
	body, response := f.request(client, "POST", "/api/user/registration", `{"login":" tester ","password":"old-pass"}`, 200)
	if body["login"] != "tester" || body["password"] != nil {
		t.Fatal(body)
	}
	if cookies := response.Cookies(); len(cookies) != 2 {
		t.Fatal(cookies)
	} else {
		for _, cookie := range cookies {
			if !cookie.HttpOnly || cookie.MaxAge != 30*24*60*60 || cookie.SameSite != http.SameSiteLaxMode || cookie.Path != "/" {
				t.Fatalf("session cookie: %+v", cookie)
			}
		}
	}
	f.authenticated(client, true)
	f.request(authClient(t), "POST", "/api/user/registration", `{"login":"tester","password":"other-pass"}`, 409)
	f.request(client, "POST", "/api/user/logout", "", 200)
	f.authenticated(client, false)
	for _, password := range []string{"wrong", "old-pass"} {
		body, _ := f.request(client, "POST", "/api/user/auth", `{"login":"tester","password":"`+password+`"}`, 200)
		if body["auth"] != (password == "old-pass") {
			t.Fatal(body)
		}
	}
	f.authenticated(client, true)
}

func TestAuthHTTPPasswordChangeRevokesOtherSessions(t *testing.T) {
	f := newAuthHTTPFixture(t)
	first, second := authClient(t), authClient(t)
	f.request(first, "POST", "/api/user/registration", `{"login":"tester","password":"old-pass"}`, 200)
	f.request(second, "POST", "/api/user/auth", `{"login":"tester","password":"old-pass"}`, 200)
	f.request(first, "PUT", "/api/account/password", `{"currentPassword":"wrong","newPassword":"new-pass"}`, 400)
	f.authenticated(second, true)
	f.request(first, "PUT", "/api/account/password", `{"currentPassword":"old-pass","newPassword":"new-pass"}`, 204)
	f.authenticated(first, true)
	f.authenticated(second, false)
	for _, password := range []string{"old-pass", "new-pass"} {
		body, _ := f.request(second, "POST", "/api/user/auth", `{"login":"tester","password":"`+password+`"}`, 200)
		if body["auth"] != (password == "new-pass") {
			t.Fatal(body)
		}
	}
	f.request(authClient(t), "PUT", "/api/account/password", `{"currentPassword":"new-pass","newPassword":"next-pass"}`, 401)
}

func TestAuthHTTPSessionExpiryAndUserBinding(t *testing.T) {
	f := newAuthHTTPFixture(t)
	first, second := authClient(t), authClient(t)
	f.request(first, "POST", "/api/user/registration", `{"login":"tester","password":"old-pass"}`, 200)
	f.request(second, "POST", "/api/user/registration", `{"login":"another","password":"old-pass"}`, 200)
	request, _ := http.NewRequest("GET", f.url, nil)
	for _, cookie := range second.Jar.Cookies(request.URL) {
		if cookie.Name == cookieSessionID {
			first.Jar.SetCookies(request.URL, []*http.Cookie{cookie})
		}
	}
	f.authenticated(first, false)
	if _, err := f.pool.Exec(t.Context(), `UPDATE dndshare.users_session SET created_at=now()-interval '31 days'`); err != nil {
		t.Fatal(err)
	}
	f.authenticated(second, false)
	if count, err := f.store.DeleteExpiredSessions(t.Context()); err != nil || count != 2 {
		t.Fatal(count, err)
	}
}

func TestAuthHTTPValidationAndRateLimit(t *testing.T) {
	f := newAuthHTTPFixture(t)
	client := authClient(t)
	for _, body := range []string{`{`, `{"login":"ab","password":"valid"}`, `{"login":"tester","password":"a"}`} {
		f.request(client, "POST", "/api/user/registration", body, 400)
	}
	f.request(client, "POST", "/api/user/registration", `{"login":"tester","password":"valid-pass"}`, 200)
	f.request(client, "PUT", "/api/account/password", `{`, 400)
	f.request(client, "PUT", "/api/account/game-context", `{`, 400)
	for range 10 {
		f.request(client, "POST", "/api/user/auth", `{"login":"missing","password":"wrong"}`, 200)
	}
	_, response := f.request(client, "POST", "/api/user/auth", `{"login":"missing","password":"wrong"}`, 429)
	if response.Header.Get("Retry-After") == "" {
		t.Fatal("missing rate limit delay")
	}
	f.authenticated(client, true)
}

func TestAuthHTTPRoleChangesApplyToExistingSession(t *testing.T) {
	f := newAuthHTTPFixture(t)
	client := authClient(t)
	f.request(client, "GET", "/api/admin-panel/users", "", 401)
	body, _ := f.request(client, "POST", "/api/user/registration", `{"login":"tester","password":"valid-pass"}`, 200)
	f.request(client, "GET", "/api/admin-panel/users", "", 401)
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO dndshare.role(name) VALUES('ADMIN')`); err != nil {
		t.Fatal(err)
	}
	id := int64(body["id"].(float64))
	if err := f.store.AddRole(t.Context(), id, RoleAdmin); err != nil {
		t.Fatal(err)
	}
	users, _ := f.request(client, "GET", "/api/admin-panel/users", "", 200)
	if len(users["users"].([]any)) != 1 {
		t.Fatal(users)
	}
	if err := f.store.RemoveRole(t.Context(), id, RoleAdmin); err != nil {
		t.Fatal(err)
	}
	f.request(client, "GET", "/api/admin-panel/users", "", 401)
}
