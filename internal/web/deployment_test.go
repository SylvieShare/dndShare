package web

import (
	"context"
	"dndshare/internal/config"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestDeploymentCandidateDoesNotStartJobsBeforeRecovery(t *testing.T) {
	state := deploymentState{disabled: true}
	if _, ok := state.beginJob(); ok {
		t.Fatal("candidate allowed a job")
	}
	failure := errors.New("database unavailable")
	if state.activate(func() error { return failure }) != failure {
		t.Fatal("lost recovery error")
	}
	if _, ok := state.beginJob(); ok {
		t.Fatal("failed recovery enabled jobs")
	}
	calls := 0
	if err := state.activate(func() error { calls++; return nil }); err != nil {
		t.Fatal(err)
	}
	unlock, ok := state.beginJob()
	if !ok {
		t.Fatal("activated instance still rejects jobs")
	}
	unlock()
	_ = state.activate(func() error { calls++; return nil })
	if calls != 1 {
		t.Fatal("repeated activation ran global recovery again")
	}
}
func TestDeploymentControlRejectsProxyAndNonLocalRequests(t *testing.T) {
	server := New(config.Config{}, nil, nil)
	mux := http.NewServeMux()
	server.routesDeployment(mux)
	for _, test := range []struct{ remote, forwarded string }{{"203.0.113.1:30", ""}, {"127.0.0.1:30", "203.0.113.1"}} {
		request := httptest.NewRequest("POST", "/internal/deployment/activate", nil)
		request.RemoteAddr = test.remote
		request.Header.Set("X-Forwarded-For", test.forwarded)
		response := httptest.NewRecorder()
		mux.ServeHTTP(response, request)
		if response.Code != 404 {
			t.Fatalf("control exposed: %d", response.Code)
		}
	}
}
func TestDeploymentDrainClosesStreamsAndRejectsNewJobs(t *testing.T) {
	server := New(config.Config{}, nil, nil)
	job := &activeJob{cancel: &atomic.Bool{}}
	server.jobs.active[1] = job
	server.BeginDrain()
	server.BeginDrain()
	select {
	case <-server.deployment.draining:
	default:
		t.Fatal("SSE drain was not signaled")
	}
	if _, _, err := server.jobs.start(context.Background(), "recount", 1); !errors.Is(err, errDeploymentDraining) {
		t.Fatalf("new job allowed: %v", err)
	}
	if !job.cancel.Load() {
		t.Fatal("running job was not cancelled")
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Millisecond)
	defer cancel()
	if err := server.WaitForJobs(ctx); !errors.Is(err, context.DeadlineExceeded) {
		t.Fatalf("drain ignored deadline: %v", err)
	}
	delete(server.jobs.active, 1)
	if err := server.WaitForJobs(context.Background()); err != nil {
		t.Fatal(err)
	}
}
