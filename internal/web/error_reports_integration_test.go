package web

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"dndshare/internal/config"
	"dndshare/internal/store"
)

func reportTool(t *testing.T, s *Server, name string, args map[string]any) any {
	t.Helper()
	raw := make(map[string]json.RawMessage, len(args))
	for key, value := range args {
		raw[key], _ = json.Marshal(value)
	}
	result, err := s.dispatchTool(httptest.NewRequest("POST", "/mcp", nil), name, raw)
	if err != nil {
		t.Fatalf("%s: %v", name, err)
	}
	return result
}

func TestErrorReportHTTPAndMCPLifecyclePostgres(t *testing.T) {
	f := newAuthHTTPFixture(t)
	guest, admin := authClient(t), authClient(t)
	const imageData = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII="
	created, _ := f.request(guest, "POST", "/api/error-reports",
		fmt.Sprintf(`{"description":"Не видна кнопка","pageUrl":"/handbook","element":{"selector":".hb-heading","platform":"mobile"},"screenshot":"data:image/png;base64,%s"}`, imageData), 201)
	id := int64(created["id"].(float64))
	if created["approved"] != false || created["userId"] != nil {
		t.Fatal(created)
	}
	f.request(guest, "GET", "/api/error-report-review/reports", "", 401)
	f.request(guest, "GET", fmt.Sprintf("/api/error-report-review/reports/%d/screenshot", id), "", 401)
	user, _ := f.request(admin, "POST", "/api/user/registration", `{"login":"reviewer","password":"secret-pass"}`, 200)
	uid := int64(user["id"].(float64))
	f.request(admin, "GET", "/api/error-report-review/reports", "", 401)
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO dndshare.role(name) VALUES('ADMIN'),('ERROR_REPORT_AUTO_APPROVE');
	 INSERT INTO dndshare.users_role(user_id,role_id) SELECT $1,id FROM dndshare.role`, uid); err != nil {
		t.Fatal(err)
	}
	f.request(admin, "GET", "/api/error-report-review/reports", "", 200)
	s := New(config.Config{MCPWriteEnabled: true}, f.store, nil)
	empty := reportTool(t, s, "error_reports_list", nil).([]store.ErrorReport)
	if empty == nil || len(empty) != 0 {
		t.Fatalf("empty queue must be an array: %#v", empty)
	}
	f.request(admin, "PATCH", fmt.Sprintf("/api/admin-panel/error-reports/%d/approval", id), `{"approved":true}`, 200)
	image, err := admin.Get(fmt.Sprintf("%s/api/error-report-review/reports/%d/screenshot", f.url, id))
	if err != nil {
		t.Fatal(err)
	}
	bytes, err := io.ReadAll(image.Body)
	image.Body.Close()
	if err != nil || image.StatusCode != 200 || image.Header.Get("Content-Type") != "image/png" || base64.StdEncoding.EncodeToString(bytes) != imageData {
		t.Fatalf("screenshot round-trip failed: %v", err)
	}
	imageResult := reportTool(t, s, "error_report_screenshot", map[string]any{"id": id}).(mcpToolResult)
	if len(imageResult.Content) != 2 || imageResult.Content[1].Type != "image" || imageResult.Content[1].Data != imageData {
		t.Fatal("MCP must return the stored screenshot as native image content")
	}
	if !reportTool(t, s, "error_reports_list", map[string]any{"summaryOnly": true}).(errorReportListProbe).HasReports {
		t.Fatal("approved report missing from queue")
	}
	lock := reportTool(t, s, "error_report_lock_acquire", nil).(map[string]any)
	leaseID := lock["leaseId"].(string)
	t.Cleanup(func() { _, _ = f.store.ReleaseErrorReportAutomationLease(t.Context(), leaseID) })
	reportTool(t, s, "error_reports_claim", map[string]any{"ids": []int64{id}, "leaseId": leaseID})
	question := reportTool(t, s, "error_report_question_create", map[string]any{"id": id, "question": "Какие шаги?", "leaseId": leaseID}).(store.ErrorReportMessage)
	if question.Sender != "AI" || question.ErrorReportID != id {
		t.Fatal(question)
	}
	if reportTool(t, s, "error_reports_list", map[string]any{"summaryOnly": true}).(errorReportListProbe).HasReports {
		t.Fatal("question should pause processing")
	}
	f.request(admin, "POST", fmt.Sprintf("/api/error-report-review/reports/%d/messages", id), `{"message":"Открыть справочник"}`, 201)
	reportTool(t, s, "error_reports_claim", map[string]any{"ids": []int64{id}, "leaseId": leaseID})
	reportTool(t, s, "error_report_title_set", map[string]any{"id": id, "title": "Кнопка справочника", "leaseId": leaseID})
	reportTool(t, s, "error_report_resolve", map[string]any{"id": id, "resolution": "Исправлено", "commitSha": "abcdef1234567", "leaseId": leaseID})
	listed, _ := f.request(admin, "GET", "/api/error-report-review/reports", "", 200)
	report := listed["reports"].([]any)[0].(map[string]any)
	if report["status"] != "RESOLVED" || len(report["messages"].([]any)) != 2 || report["resolvedCommitSha"] != "abcdef1234567" {
		t.Fatal(report)
	}
	f.request(admin, "POST", fmt.Sprintf("/api/error-report-review/reports/%d/archive", id), "", 200)
	f.request(admin, "POST", fmt.Sprintf("/api/admin-panel/error-reports/%d/reopen", id), "", 200)
	// Reopening keeps evidence and conversation, including the human answer.
	queue := reportTool(t, s, "error_reports_list", map[string]any{"compact": true}).(compactErrorReportList)
	if len(queue.IDs) != 1 || queue.IDs[0] != id || len(queue.Reports[0].Messages) != 2 {
		t.Fatal(queue)
	}
	auto, _ := f.request(admin, "POST", "/api/error-reports", `{"description":"Вторая ошибка","pageUrl":"/chars","element":{"selector":"main"}}`, 201)
	if auto["approved"] != true || auto["userId"] != float64(uid) {
		t.Fatal(auto)
	}
	f.request(admin, "DELETE", fmt.Sprintf("/api/admin-panel/error-reports/%d", id), "", 200)
	var messages int
	if err := f.pool.QueryRow(t.Context(), `SELECT count(*) FROM dndshare.error_report_message WHERE error_report_id=$1`, id).Scan(&messages); err != nil || messages != 0 {
		t.Fatalf("deleted report messages: %d, %v", messages, err)
	}
}

func TestErrorReportClaimOwnershipAndRecoveryPostgres(t *testing.T) {
	f := newAuthHTTPFixture(t)
	ctx := t.Context()
	makeReport := func() int64 {
		r, err := f.store.CreateErrorReport(ctx, nil, "Ошибка", "/handbook", json.RawMessage(`{"selector":"main"}`), nil, nil, nil, nil, nil, true)
		if err != nil {
			t.Fatal(err)
		}
		return r.ID
	}
	id := makeReport()
	lease, acquired, err := f.store.AcquireErrorReportAutomationLease(ctx, "worker-a", time.Minute)
	if err != nil || !acquired {
		t.Fatalf("acquire: %v %v", acquired, err)
	}
	if _, acquired, err := f.store.AcquireErrorReportAutomationLease(ctx, "worker-b", time.Minute); err != nil || acquired {
		t.Fatalf("second worker acquired active lease: %v %v", acquired, err)
	}
	if _, claimed, err := f.store.ClaimApprovedErrorReports(ctx, lease.LeaseID, []int64{id, id + 1000}); err != nil || claimed {
		t.Fatalf("partial batch accepted: %v %v", claimed, err)
	}
	if available, err := f.store.HasApprovedErrorReports(ctx); err != nil || !available {
		t.Fatalf("partial claim changed queue: %v %v", available, err)
	}
	if _, claimed, err := f.store.ClaimApprovedErrorReports(ctx, lease.LeaseID, []int64{id}); err != nil || !claimed {
		t.Fatalf("claim: %v %v", claimed, err)
	}
	wrong := "worker-b"
	if resolved, err := f.store.ResolveApprovedErrorReport(ctx, id, "Нельзя", nil, &wrong); err != nil || resolved {
		t.Fatalf("foreign resolution: %v %v", resolved, err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE dndshare.error_report SET processing_expires_at=now()-interval '1 minute' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	if available, err := f.store.HasApprovedErrorReports(ctx); err != nil || !available {
		t.Fatalf("expired claim not recovered: %v %v", available, err)
	}
	if _, claimed, err := f.store.ClaimApprovedErrorReports(ctx, lease.LeaseID, []int64{id}); err != nil || !claimed {
		t.Fatalf("reclaim: %v %v", claimed, err)
	}
	if released, err := f.store.ReleaseErrorReportAutomationLease(ctx, lease.LeaseID); err != nil || !released {
		t.Fatalf("release: %v %v", released, err)
	}
	if available, err := f.store.HasApprovedErrorReports(ctx); err != nil || !available {
		t.Fatalf("release lost work: %v %v", available, err)
	}
}
