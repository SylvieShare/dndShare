package web

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"dndshare/internal/config"
	"dndshare/internal/store"
)

func eventReport(t *testing.T, f authHTTPFixture, approved bool) int64 {
	t.Helper()
	r, err := f.store.CreateErrorReport(t.Context(), nil, "Ошибка", "/handbook", json.RawMessage(`{"selector":"main"}`), nil, nil, nil, nil, nil, approved)
	if err != nil {
		t.Fatal(err)
	}
	return r.ID
}

func nextReportEvent(t *testing.T, lines *bufio.Scanner) store.ErrorReportEvent {
	t.Helper()
	for lines.Scan() {
		if strings.HasPrefix(lines.Text(), "data: ") {
			var event store.ErrorReportEvent
			if err := json.Unmarshal([]byte(strings.TrimPrefix(lines.Text(), "data: ")), &event); err != nil {
				t.Fatal(err)
			}
			return event
		}
	}
	t.Fatalf("event stream ended: %v", lines.Err())
	return store.ErrorReportEvent{}
}

func TestErrorReportEventsAuthReplayAndClaimedReadPostgres(t *testing.T) {
	f := newAuthHTTPFixture(t)
	id := eventReport(t, f, false)
	server := httptest.NewServer(New(config.Config{MCPAuthToken: "test-events"}, f.store, nil).Handler())
	defer server.Close()
	client := &http.Client{Timeout: 8 * time.Second}
	for _, item := range []struct {
		path, token string
		want        int
	}{
		{"/mcp/error-report-events", "", 401},
		{"/mcp/error-report-events?after=-1", "test-events", 400},
		{"/mcp/error-report-events?after=invalid", "test-events", 400},
	} {
		request, _ := http.NewRequest("GET", server.URL+item.path, nil)
		request.Header.Set("Authorization", "Bearer "+item.token)
		response, err := client.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != item.want {
			t.Fatalf("%s: %d", item.path, response.StatusCode)
		}
	}
	request, _ := http.NewRequest("GET", server.URL+"/mcp/error-report-events?after=0", nil)
	request.Header.Set("Authorization", "Bearer test-events")
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.Header.Get("Content-Type") != "text/event-stream" {
		t.Fatal(response.Header)
	}
	lines := bufio.NewScanner(response.Body)
	created := nextReportEvent(t, lines)
	if created.ReportID != id || created.Kind != "created" || created.Approved {
		t.Fatal(created)
	}
	if _, err := f.store.GetApprovedErrorReport(t.Context(), id); !errors.Is(err, store.ErrNotFound) {
		t.Fatalf("unapproved get: %v", err)
	}
	if _, err := f.store.SetErrorReportApproved(t.Context(), id, true); err != nil {
		t.Fatal(err)
	}
	approved := nextReportEvent(t, lines)
	if approved.ID <= created.ID || approved.Kind != "approved" || !approved.Approved {
		t.Fatal(approved)
	}
	response.Body.Close()
	request, _ = http.NewRequest("GET", server.URL+"/mcp/error-report-events", nil)
	request.Header.Set("Authorization", "Bearer test-events")
	request.Header.Set("Last-Event-ID", fmt.Sprint(created.ID))
	replay, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer replay.Body.Close()
	if event := nextReportEvent(t, bufio.NewScanner(replay.Body)); event.ID != approved.ID {
		t.Fatal(event)
	}
	lease, acquired, err := f.store.AcquireErrorReportAutomationLease(t.Context(), "event-owner", time.Minute)
	if err != nil || !acquired {
		t.Fatalf("lease: %v", err)
	}
	if _, claimed, err := f.store.ClaimApprovedErrorReports(t.Context(), lease.LeaseID, []int64{id}); err != nil || !claimed {
		t.Fatalf("claim: %v", err)
	}
	current, err := f.store.GetApprovedErrorReport(t.Context(), id)
	if err != nil || current.Status != "IN_PROGRESS" {
		t.Fatalf("claimed report get: %v %v", current.Status, err)
	}
}

func TestErrorReportEventRollbackAndLateCommitCursorPostgres(t *testing.T) {
	f := newAuthHTTPFixture(t)
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()
	insert := `INSERT INTO dndshare.error_report(description,page_url,element) VALUES('event','/handbook','{"selector":"main"}'::jsonb) RETURNING id`
	late, err := f.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer late.Rollback(ctx)
	var lateID int64
	if err := late.QueryRow(ctx, insert).Scan(&lateID); err != nil {
		t.Fatal(err)
	}
	// This later allocation commits first. Publishing it must not hide lateID.
	firstID := eventReport(t, f, true)
	events, err := f.store.ListErrorReportEvents(ctx, 0, 100)
	if err != nil || len(events) != 1 || events[0].ReportID != firstID {
		t.Fatalf("early publication: %v %v", events, err)
	}
	cursor := events[0].ID
	if err := late.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	events, err = f.store.ListErrorReportEvents(ctx, cursor, 100)
	if err != nil || len(events) != 1 || events[0].ReportID != lateID || events[0].ID <= cursor {
		t.Fatalf("late commit lost behind cursor: %v %v", events, err)
	}
	aborted, err := f.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := aborted.Exec(ctx, insert); err != nil {
		t.Fatal(err)
	}
	if err := aborted.Rollback(ctx); err != nil {
		t.Fatal(err)
	}
	all, err := f.store.ListErrorReportEvents(ctx, 0, 100)
	if err != nil || len(all) != 2 {
		t.Fatalf("rolled back report emitted event: %v %v", all, err)
	}
}
