package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

// CreateItemVariant copies an accessible definition into a personal draft.
// It never enables copied mechanics for another edition until reviewed.
func (s *Store) CreateItemVariant(ctx context.Context, itemID, userID, editionID int64, kind string) (Item, error) {
	if kind != "revision" && kind != "adaptation" {
		return Item{}, &RulesValidationError{Message: "Выберите новую версию или адаптацию"}
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return Item{}, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(1145980229)`); err != nil {
		return Item{}, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO dndshare.custom_item_source(user_id,name,is_default) VALUES($1,'Мои материалы',true) ON CONFLICT(user_id) WHERE is_default DO NOTHING`, userID); err != nil {
		return Item{}, err
	}
	var id int64
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.item(user_id,custom_source_id,name,name_en,type_id,parent_id,data,derived_from_item_id,derivation_kind,automation_status,automation_note)
 SELECT $2,cs.id,i.name,i.name_en,i.type_id,i.parent_id,i.data-'edition_key'-'import_fingerprint',i.id,$4,'unreviewed','Проверьте механику и связанные записи для выбранной редакции'
 FROM dndshare.item i JOIN dndshare.item_type t ON t.id=i.type_id
 JOIN dndshare.source_version v ON v.source_id=t.source_id AND v.id=$3
 JOIN dndshare.custom_item_source cs ON cs.user_id=$2 AND cs.is_default
 WHERE i.id=$1 AND (i.user_id IS NULL OR i.user_id=$2) RETURNING id`, itemID, userID, editionID, kind).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Item{}, ErrNotFound
	}
	if err != nil {
		return Item{}, err
	}
	if err = setItemCompatibility(ctx, tx, id, []ItemCompatibility{{SourceVersionID: editionID, Status: "requires_adaptation", Note: "Черновик варианта: проверьте механику и зависимости"}}); err != nil {
		return Item{}, err
	}
	// Publication provenance is retained; a revision can select a new book in the editor.
	if _, err = tx.Exec(ctx, `INSERT INTO dndshare.item_content_source(item_id,content_source_id,primary_source) SELECT $1,content_source_id,primary_source FROM dndshare.item_content_source WHERE item_id=$2`, id, itemID); err != nil {
		return Item{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return Item{}, err
	}
	items, err := s.GetByIds(ctx, []int64{id}, &userID)
	if err != nil {
		return Item{}, err
	}
	if len(items) != 1 {
		return Item{}, ErrNotFound
	}
	return items[0], nil
}
