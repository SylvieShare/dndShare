package store

import (
	"context"
	"encoding/json"
	"slices"
	"testing"
	"time"
)

func TestHandbookSyncPostgres(t *testing.T) {
	pool := currentSchemaTestPool(t)
	seedTestUsers(t, pool, 10, 20)
	seedTestItemTypes(t, pool, 5)
	s := &Store{pool: pool}
	ctx := t.Context()
	create := func(name string, owner int64) Item {
		t.Helper()
		var item Item
		var err error
		if owner == 0 {
			item, err = s.CreateBase(ctx, name, name, json.RawMessage(`{"desc":"<p>Local text</p>"}`), 5, nil, ItemMetadataPatch{})
		} else {
			item, err = s.Create(ctx, owner, name, json.RawMessage(`{}`), 5, nil, ItemMetadataPatch{})
		}
		if err != nil {
			t.Fatal(err)
		}
		return item
	}
	alpha := create("Alpha", 0)
	beta := create("Beta", 0)
	own := create("Own", 10)
	foreign := create("Foreign", 20)
	head, err := s.HandbookSyncStart(ctx, 10, 1, -1)
	if err != nil {
		t.Fatal(err)
	}
	position := head
	var got []int64
	for pageIndex := 0; ; pageIndex++ {
		page, err := s.HandbookSync(ctx, 10, 1, position, 1)
		if err != nil {
			t.Fatal(err)
		}
		if (page.Metadata != nil) != (pageIndex == 0) {
			t.Fatal("metadata must be sent on the first page only")
		}
		for _, entry := range page.Entries {
			if entry.Item == nil || entry.Deleted || entry.ChangedAt.IsZero() {
				t.Fatalf("bad full snapshot entry: %+v", entry)
			}
			got = append(got, entry.ID)
		}
		position = page.Position
		if !page.HasMore {
			if !slices.Equal(page.VisibleIDs, []int64{alpha.ID, beta.ID, own.ID}) {
				t.Fatalf("visibility manifest leaked or omitted items: %v", page.VisibleIDs)
			}
			break
		}
	}
	if !slices.Equal(got, []int64{alpha.ID, beta.ID, own.ID}) || slices.Contains(got, foreign.ID) {
		t.Fatalf("unexpected snapshot: %v", got)
	}
	if err = s.Update(ctx, alpha.ID, 10, true, "Updated Alpha", nil, alpha.Data, ItemMetadataPatch{}); err != nil {
		t.Fatal(err)
	}
	refs, err := s.Delete(ctx, beta.ID, 10, true)
	if err != nil || refs != (ItemIconRefs{}) {
		t.Fatalf("soft deletion must retain media: %+v %v", refs, err)
	}
	var deleted bool
	if err = pool.QueryRow(ctx, "SELECT deleted FROM dndshare.item WHERE id=$1", beta.ID).Scan(&deleted); err != nil || !deleted {
		t.Fatal("physical item row was removed", err)
	}
	if rows, err := s.GetByIds(ctx, []int64{beta.ID}, nil); err != nil || len(rows) != 0 {
		t.Fatalf("deleted item resolved through ordinary API: %+v %v", rows, err)
	}
	deltaHead, err := s.HandbookSyncStart(ctx, 10, 1, head.Revision)
	if err != nil {
		t.Fatal(err)
	}
	delta, err := s.HandbookSync(ctx, 10, 1, deltaHead, 250)
	if err != nil || len(delta.Entries) != 2 || delta.Entries[0].Item.Name != "Updated Alpha" ||
		!delta.Entries[1].Deleted || delta.Entries[1].Item != nil {
		t.Fatalf("update/delete delta: %+v %v", delta, err)
	}
	// A public item becoming another user's private item must disappear from
	// the manifest, without sending its new content to the previous reader.
	schemaTestExec(t, pool, `UPDATE dndshare.item SET user_id=20,
 custom_source_id=(SELECT id FROM dndshare.custom_item_source WHERE user_id=20 AND is_default)
 WHERE id=$1`, alpha.ID)
	next, _ := s.HandbookSyncStart(ctx, 10, 1, deltaHead.Revision)
	page, err := s.HandbookSync(ctx, 10, 1, next, 250)
	if err != nil || slices.Contains(page.VisibleIDs, alpha.ID) || len(page.Entries) != 0 {
		t.Fatalf("lost access must prune without leaking content: %+v %v", page, err)
	}
}

func TestHandbookSyncCommitOrderPostgres(t *testing.T) {
	pool := currentSchemaTestPool(t)
	seedTestItemTypes(t, pool, 5)
	schemaTestExec(t, pool, `INSERT INTO dndshare.item(id,type_id,name,data) VALUES(1,5,'one','{}'),(2,5,'two','{}')`)
	s := &Store{pool: pool}
	head, err := s.HandbookSyncStart(t.Context(), 10, 1, -1)
	if err != nil {
		t.Fatal(err)
	}
	first, err := pool.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer first.Rollback(context.Background())
	if _, err = first.Exec(t.Context(), "UPDATE dndshare.item SET name='one changed' WHERE id=1"); err != nil {
		t.Fatal(err)
	}
	done := make(chan error, 1)
	go func() {
		_, err := pool.Exec(t.Context(), "UPDATE dndshare.item SET name='two changed' WHERE id=2")
		done <- err
	}()
	select {
	case err := <-done:
		t.Fatalf("later revision committed before the earlier transaction: %v", err)
	case <-time.After(40 * time.Millisecond):
	}
	during, err := s.HandbookSyncStart(t.Context(), 10, 1, head.Revision)
	if err != nil || during.Revision != head.Revision {
		t.Fatalf("uncommitted watermark exposed: %+v %v", during, err)
	}
	// The second writer must not hold item 2's row while waiting on the
	// global clock, or this multi-row transaction would deadlock.
	if _, err = first.Exec(t.Context(), "UPDATE dndshare.item SET name='two intermediate' WHERE id=2"); err != nil {
		t.Fatal(err)
	}
	if err = first.Commit(t.Context()); err != nil {
		t.Fatal(err)
	}
	if err = <-done; err != nil {
		t.Fatal(err)
	}
	after, _ := s.HandbookSyncStart(t.Context(), 10, 1, head.Revision)
	page, err := s.HandbookSync(t.Context(), 10, 1, after, 250)
	if err != nil || len(page.Entries) != 2 {
		t.Fatalf("committed writes were skipped: %+v %v", page, err)
	}
}
