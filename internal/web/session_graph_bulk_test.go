package web

import (
	"math"
	"testing"

	"dndshare/internal/store"
)

func TestGraphBulkValidation(t *testing.T) {
	if !validGraphLevel("chapters") || !validGraphLevel("scenes") || !validGraphLevel("blocks") {
		t.Fatal("all narrative graph levels must be accepted")
	}
	if validGraphLevel("edges") {
		t.Fatal("unknown graph level must be rejected")
	}
	if !validGraphNodeIDs([]int64{1, 2, 3}) {
		t.Fatal("distinct positive ids must be accepted")
	}
	for _, ids := range [][]int64{nil, {0}, {1, 1}} {
		if validGraphNodeIDs(ids) {
			t.Fatalf("invalid ids accepted: %v", ids)
		}
	}
	if !validGraphPositions([]store.GraphNodePosition{{ID: 1, X: -120.5, Y: 840}}) {
		t.Fatal("finite graph coordinates must be accepted")
	}
	if validGraphPositions([]store.GraphNodePosition{{ID: 1, X: math.Inf(1), Y: 0}}) {
		t.Fatal("infinite graph coordinate must be rejected")
	}
	if !validGraphStatus("chapters", "none") || !validGraphStatus("scenes", "in_progress") {
		t.Fatal("canonical chapter and scene statuses must be accepted")
	}
	if validGraphStatus("blocks", "in_progress") || validGraphStatus("chapters", "unknown") {
		t.Fatal("status must be limited to canonical narrative values")
	}
}
