package web

import (
	"fmt"
	"testing"
)

func TestSessionCreationIncludesStarterStory(t *testing.T) {
	f := newAuthHTTPFixture(t)
	client := authClient(t)
	f.request(client, "POST", "/api/user/registration", `{"login":"starter-story","password":"test-pass"}`, 200)

	// An error in the last starter insert must also roll back the session and its graph.
	if _, err := f.pool.Exec(t.Context(), `ALTER TABLE dndshare.session_scene_item
		ADD CONSTRAINT test_reject_description CHECK (type <> 'text')`); err != nil {
		t.Fatal(err)
	}
	const request = `{"name":"Новое приключение","systemId":1,"sourceVersionId":1}`
	f.request(client, "POST", "/api/sessions", request, 500)
	var remaining int
	if err := f.pool.QueryRow(t.Context(), `
		SELECT (SELECT count(*) FROM dndshare.session)
			+ (SELECT count(*) FROM dndshare.session_arc)
			+ (SELECT count(*) FROM dndshare.session_chapter)
			+ (SELECT count(*) FROM dndshare.session_scene)
			+ (SELECT count(*) FROM dndshare.session_scene_item)
			+ (SELECT count(*) FROM dndshare.session_presentation_state)`).Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("failed create left %d records: %v", remaining, err)
	}
	if _, err := f.pool.Exec(t.Context(), `ALTER TABLE dndshare.session_scene_item
		DROP CONSTRAINT test_reject_description`); err != nil {
		t.Fatal(err)
	}

	created, _ := f.request(client, "POST", "/api/sessions", request, 200)
	sessions, _ := f.request(client, "GET", "/api/sessions", "", 200)
	listed := onlyStarterRecord(t, sessions, "sessions")
	brief, _ := listed["currentChapter"].(map[string]any)
	listSession, _ := listed["session"].(map[string]any)
	if listSession["uuid"] != created["uuid"] || brief["name"] != "Начало истории" || brief["imageUrl"] != "" {
		t.Fatalf("session list missing current chapter: %+v", listed)
	}

	sessionPath := "/api/sessions/" + created["uuid"].(string)
	sessionDetail, _ := f.request(client, "GET", sessionPath, "", 200)
	session := sessionDetail["session"].(map[string]any)
	graph, _ := f.request(client, "GET", sessionPath+"/chapter-graph", "", 200)
	arc := onlyStarterRecord(t, graph, "arcs")
	chapter := onlyStarterRecord(t, graph, "chapters")
	if arc["name"] != "Основная арка" || chapter["arcId"] != arc["id"] ||
		chapter["id"] != session["currentChapterId"] || session["status"] != "stopped" ||
		chapter["number"] != "1" || chapter["name"] != "Начало истории" ||
		chapter["sceneCount"] != float64(1) || chapter["positionY"] != float64(80) {
		t.Fatalf("unexpected starter graph: %+v, session: %+v", graph, session)
	}

	chapterPath := fmt.Sprintf("%s/chapters/%d", sessionPath, int64(chapter["id"].(float64)))
	scenes, _ := f.request(client, "GET", chapterPath+"/scene-graph", "", 200)
	scene := onlyStarterRecord(t, scenes, "scenes")
	if scene["chapterId"] != chapter["id"] || scene["name"] != "Первая сцена" {
		t.Fatalf("unexpected starter scene: %+v", scene)
	}
	scenePath := fmt.Sprintf("%s/scenes/%d", sessionPath, int64(scene["id"].(float64)))
	blocks, _ := f.request(client, "GET", scenePath+"/block-graph", "", 200)
	block := onlyStarterRecord(t, blocks, "items")
	data, _ := block["data"].(map[string]any)
	if block["sceneId"] != scene["id"] || block["type"] != "text" ||
		block["title"] != "Описание сцены" || data["text"] != "" {
		t.Fatalf("unexpected starter description: %+v", block)
	}

	changed, _ := f.request(client, "PATCH", chapterPath, fmt.Sprintf(
		`{"arcId":%d,"number":"1","name":"Пролог","status":"planned","imageId":0}`, int64(arc["id"].(float64))), 200)
	changedScene, _ := f.request(client, "PATCH", scenePath, `{"name":"Встреча","status":"draft","imageId":null}`, 200)
	if changed["name"] != "Пролог" || changedScene["name"] != "Встреча" {
		t.Fatalf("could not edit generated entries: %+v, %+v", changed, changedScene)
	}
	f.request(client, "POST", sessionPath+"/chapters", fmt.Sprintf(
		`{"arcId":%d,"number":"2","name":"Следующая глава","status":"planned"}`, int64(arc["id"].(float64))), 400)
	f.request(client, "POST", chapterPath+"/scenes", `{"name":"Ещё одна сцена","status":"draft"}`, 400)

	const coverID = int64(3000000000)
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO dndshare.storage_image (id, user_id, type, url)
		SELECT $1, id, 'image', '/cover.webp' FROM dndshare.users WHERE login = 'starter-story'`, coverID); err != nil {
		t.Fatal(err)
	}
	withCover, _ := f.request(client, "PATCH", chapterPath, fmt.Sprintf(
		`{"arcId":%d,"number":"1","name":"Пролог","status":"planned","imageId":%d}`,
		int64(arc["id"].(float64)), coverID), 200)
	if withCover["imageId"] != float64(coverID) || withCover["imageUrl"] != "/cover.webp" {
		t.Fatalf("could not add a cover to the starter chapter: %+v", withCover)
	}
}

func onlyStarterRecord(t *testing.T, response map[string]any, key string) map[string]any {
	t.Helper()
	items, ok := response[key].([]any)
	if !ok || len(items) != 1 {
		t.Fatalf("expected one %s record: %+v", key, response)
	}
	return items[0].(map[string]any)
}
