package store

import (
	"context"
	"dndshare/internal/documentpatch"
	"encoding/json"
	"errors"
	"testing"
)

func testCharacterDocumentHistory(t *testing.T, s *Store) {
	ctx := WithDocumentActor(context.Background(), 1)
	if _, err := s.pool.Exec(ctx, `INSERT INTO dndshare."char"(id,user_id,data) VALUES(7701,1,'{"values":{"hp":{"current":10},"items":[{"uid":"stable","count":2}]}}'),(7702,2,'{"values":{"hp":{"current":20}}}')`); err != nil {
		t.Fatal(err)
	}
	defer s.pool.Exec(ctx, `DELETE FROM dndshare."char" WHERE id IN(7701,7702)`)
	before := json.RawMessage(`{"values":{"hp":{"current":10},"items":[{"uid":"stable","count":2}]}}`)
	after := json.RawMessage(`{"values":{"hp":{"current":8},"items":[{"uid":"stable","count":1}]}}`)
	id := "71000000-0000-4000-8000-000000000001"
	mutation := WithDocumentMutation(ctx, id, "request-hash", json.RawMessage(`[{"action":"health"}]`))
	beforeDoc, _ := decodeTransferDocument(before)
	otherDoc, _ := decodeTransferDocument(json.RawMessage(`{"values":{"hp":{"current":19}}}`))
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	version := int64(1)
	if _, err = persistCharacterDocument(mutation, tx, 7701, after, &version); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	change, err := s.CharacterMutation(ctx, 7701, id)
	if err != nil {
		t.Fatal(err)
	}
	if change.Version != 2 || change.FromVersion != 1 || change.AuthorUserID == nil || *change.AuthorUserID != 1 || change.RequestHash != "request-hash" {
		t.Fatalf("invalid receipt: %+v", change)
	}
	restored, err := documentpatch.Apply(after, change.Inverse)
	if err != nil {
		t.Fatal(err)
	}
	a, _ := documentpatch.Decode(before)
	b, _ := documentpatch.Decode(restored)
	if !documentpatch.Equal(a, b) {
		t.Fatalf("inverse: %s", restored)
	}
	tx, err = s.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = persistCharacterDocument(ctx, tx, 7701, before, &version); !errors.Is(err, ErrCharacterVersion) {
		t.Fatalf("stale version: %v", err)
	}
	_ = tx.Rollback(ctx)
	// Both sides of a domain command carry one transaction ID and roll back together.
	tx, err = s.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err = saveTransferDocument(ctx, tx, 7701, beforeDoc); err != nil {
		t.Fatal(err)
	}
	if err = saveTransferDocument(ctx, tx, 7702, otherDoc); err != nil {
		t.Fatal(err)
	}
	_ = tx.Rollback(ctx)
	changes, err := s.CharacterHistory(ctx, 7701, 0)
	if err != nil || len(changes) != 1 {
		t.Fatalf("rollback history: %d %v", len(changes), err)
	}
	tx, err = s.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if err = saveTransferDocument(ctx, tx, 7701, beforeDoc); err != nil {
		t.Fatal(err)
	}
	if err = saveTransferDocument(ctx, tx, 7702, otherDoc); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	left, err := s.CharacterHistory(ctx, 7701, 0)
	if err != nil {
		t.Fatal(err)
	}
	right, err := s.CharacterHistory(ctx, 7702, 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(left) != 2 || len(right) != 1 || left[0].TransactionID != right[0].TransactionID {
		t.Fatal("domain changes did not share their transaction")
	}
	replay, err := s.CharacterChanges(ctx, 7701, 1)
	if err != nil || len(replay) != 2 {
		t.Fatalf("replay: %d %v", len(replay), err)
	}
}
