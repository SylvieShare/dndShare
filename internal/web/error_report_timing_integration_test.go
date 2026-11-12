package web

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"dndshare/internal/config"
	"dndshare/internal/store"
)

func TestErrorReportTimingPostgres(t *testing.T) {
	f := newAuthHTTPFixture(t)
	ctx := t.Context()
	report, err := f.store.CreateErrorReport(ctx, nil, "Замеры", "/", json.RawMessage(`{"selector":"main"}`), nil, nil, nil, nil, nil, true)
	if err != nil {
		t.Fatal(err)
	}
	id := report.ID
	if _, err := f.pool.Exec(ctx, `UPDATE dndshare.error_report SET created_at=now()-interval '1 hour' WHERE id=$1`, id); err != nil {
		t.Fatal(err)
	}
	lease, acquired, err := f.store.AcquireErrorReportAutomationLease(ctx, "timing-owner", time.Hour)
	if err != nil || !acquired {
		t.Fatalf("lease %v %v", acquired, err)
	}
	if _, claimed, err := f.store.ClaimApprovedErrorReports(ctx, lease.LeaseID, []int64{id}); err != nil || !claimed {
		t.Fatalf("claim %v %v", claimed, err)
	}
	s := New(config.Config{MCPWriteEnabled: true}, f.store, nil)
	setPhase := func(phase string) {
		t.Helper()
		reportTool(t, s, "error_report_phase_set", map[string]any{"id": id, "phase": phase, "leaseId": lease.LeaseID})
	}
	advance := func() {
		t.Helper()
		if _, err := f.pool.Exec(ctx, `UPDATE dndshare.error_report_work_interval
        SET started_at=started_at-interval '1 minute',ended_at=ended_at-interval '1 minute' WHERE error_report_id=$1`, id); err != nil {
			t.Fatal(err)
		}
	}
	if updated, err := f.store.SetClaimedErrorReportPhase(ctx, id, "analysis", "foreign-lease"); err != nil || updated {
		t.Fatalf("foreign write %v %v", updated, err)
	}
	if _, err := f.store.SetClaimedErrorReportPhase(ctx, id, "invented", lease.LeaseID); err == nil {
		t.Fatal("invalid phase accepted")
	}
	for _, phase := range []string{"analysis", "fix", "test", "fix", "test", "deploy"} {
		setPhase(phase)
		advance()
	}
	setPhase("deploy") // Retry must keep the existing interval, including its start.
	current := reportTool(t, s, "error_report_get", map[string]any{"id": id}).(store.ErrorReport)
	if current.Timing == nil || current.Timing.IntervalCount != 6 || current.Timing.TotalMs < 360000 || *current.Timing.ActivePhase != "deploy" {
		t.Fatalf("timing %#v", current.Timing)
	}
	if current.Timing.BeforeWorkMs < 3000000 {
		t.Fatalf("queue time %#v", current.Timing)
	}
	if current.Timing.Phases[1].DurationMs < 120000 || current.Timing.Phases[2].DurationMs < 120000 {
		t.Fatalf("repeated phases not summed %#v", current.Timing.Phases)
	}
	setPhase("pause")
	paused := reportTool(t, s, "error_report_get", map[string]any{"id": id}).(store.ErrorReport)
	if paused.Timing.ActivePhase != nil || paused.Timing.IntervalCount != 6 {
		t.Fatalf("pause %#v", paused.Timing)
	}
	setPhase("analysis")
	reportTool(t, s, "error_report_question_create", map[string]any{"id": id, "question": "Уточните контекст", "leaseId": lease.LeaseID})
	waiting := reportTool(t, s, "error_report_get", map[string]any{"id": id}).(store.ErrorReport)
	if waiting.Timing.ActivePhase != nil {
		t.Fatal("question did not stop the timer")
	}
	// Continue through the real HTTP reviewer contract.
	admin := authClient(t)
	user, _ := f.request(admin, "POST", "/api/user/registration", `{"login":"timing-admin","password":"secret-pass"}`, 200)
	if _, err := f.pool.Exec(ctx, `INSERT INTO dndshare.role(name) VALUES('ADMIN');
        INSERT INTO dndshare.users_role(user_id,role_id) SELECT $1,id FROM dndshare.role WHERE name='ADMIN'`, int64(user["id"].(float64))); err != nil {
		t.Fatal(err)
	}
	f.request(admin, "POST", fmt.Sprintf("/api/error-report-review/reports/%d/messages", id), `{"message":"Ответ"}`, 201)
	reportTool(t, s, "error_reports_claim", map[string]any{"ids": []int64{id}, "leaseId": lease.LeaseID})
	setPhase("deploy")
	reportTool(t, s, "error_report_resolve", map[string]any{"id": id, "resolution": "Опубликовано", "leaseId": lease.LeaseID})
	listed, _ := f.request(admin, "GET", "/api/error-report-review/reports", "", 200)
	timing := listed["reports"].([]any)[0].(map[string]any)["timing"].(map[string]any)
	if timing["activePhase"] != nil || timing["intervalCount"] != float64(8) {
		t.Fatalf("public timing %#v", timing)
	}
	f.request(admin, "POST", fmt.Sprintf("/api/admin-panel/error-reports/%d/reopen", id), "", 200)
	reopened := reportTool(t, s, "error_report_get", map[string]any{"id": id}).(store.ErrorReport)
	if reopened.Timing.IntervalCount != 8 {
		t.Fatal("reopen discarded timing history")
	}
	f.request(admin, "DELETE", fmt.Sprintf("/api/admin-panel/error-reports/%d", id), "", 200)
	var intervals int
	if err := f.pool.QueryRow(ctx, `SELECT count(*) FROM dndshare.error_report_work_interval WHERE error_report_id=$1`, id).Scan(&intervals); err != nil || intervals != 0 {
		t.Fatalf("cascade %d %v", intervals, err)
	}
}

func TestErrorReportTimingLeaseExpiryPostgres(t *testing.T) {
	f := newAuthHTTPFixture(t)
	ctx := t.Context()
	report, err := f.store.CreateErrorReport(ctx, nil, "Замеры", "/", json.RawMessage(`{"selector":"main"}`), nil, nil, nil, nil, nil, true)
	if err != nil {
		t.Fatal(err)
	}
	lease, _, err := f.store.AcquireErrorReportAutomationLease(ctx, "expiring-timer", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	if _, ok, err := f.store.ClaimApprovedErrorReports(ctx, lease.LeaseID, []int64{report.ID}); err != nil || !ok {
		t.Fatal(err)
	}
	if _, err := f.store.SetClaimedErrorReportPhase(ctx, report.ID, "analysis", lease.LeaseID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.pool.Exec(ctx, `UPDATE dndshare.error_report_work_interval SET started_at=now()-interval '10 minutes' WHERE error_report_id=$1;
        UPDATE dndshare.error_report SET processing_expires_at=now()-interval '5 minutes' WHERE id=$1`, report.ID); err != nil {
		t.Fatal(err)
	}
	// Read-side recovery closes the interval at expiry rather than at cleanup time.
	current, err := f.store.GetApprovedErrorReport(ctx, report.ID)
	if err != nil {
		t.Fatal(err)
	}
	if current.Timing.ActivePhase != nil || current.Timing.TotalMs < 299000 || current.Timing.TotalMs > 301000 {
		t.Fatalf("expired clock %#v", current.Timing)
	}
	if _, err := f.store.HasApprovedErrorReports(ctx); err != nil {
		t.Fatal(err)
	}
	if _, ok, err := f.store.ClaimApprovedErrorReports(ctx, lease.LeaseID, []int64{report.ID}); err != nil || !ok {
		t.Fatal(err)
	}
	if _, err := f.store.SetClaimedErrorReportPhase(ctx, report.ID, "fix", lease.LeaseID); err != nil {
		t.Fatal(err)
	}
	if _, err := f.store.ReleaseErrorReportAutomationLease(ctx, lease.LeaseID); err != nil {
		t.Fatal(err)
	}
	current, err = f.store.GetApprovedErrorReport(ctx, report.ID)
	if err != nil || current.Timing.ActivePhase != nil || current.Timing.IntervalCount != 2 {
		t.Fatalf("release %#v %v", current.Timing, err)
	}
}
