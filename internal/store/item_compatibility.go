package store

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
)

type ItemCompatibility struct {
	SourceVersionID  int64   `json:"sourceVersionId"`
	Version          string  `json:"version,omitempty"`
	Status           string  `json:"status"`
	ReplacedByItemID *int64  `json:"replacedByItemId,omitempty"`
	AdapterCode      *string `json:"adapterCode,omitempty"`
	Note             string  `json:"note"`
}

func (c ItemCompatibility) Selectable() bool { return c.Status == "native" || c.Status == "compatible" }

func ValidateItemCompatibility(rows []ItemCompatibility) error {
	seen := map[int64]bool{}
	for _, row := range rows {
		if row.SourceVersionID <= 0 || seen[row.SourceVersionID] {
			return &RulesValidationError{Message: "Редакции должны быть заданы без повторений"}
		}
		seen[row.SourceVersionID] = true
		switch row.Status {
		case "native", "compatible", "legacy", "blocked", "requires_adaptation":
		default:
			return &RulesValidationError{Message: "Неизвестный статус совместимости"}
		}
		if row.ReplacedByItemID != nil && (row.Status != "legacy" || *row.ReplacedByItemID <= 0) {
			return &RulesValidationError{Message: "Замена задаётся только для прежней версии"}
		}
		// Adaptations are prepared as concrete variants. Unimplemented adapter codes
		// must never turn into a hidden runtime transformation.
		if row.AdapterCode != nil && strings.TrimSpace(*row.AdapterCode) != "" {
			return &RulesValidationError{Message: "Создайте адаптированный вариант с явной механикой"}
		}
		if len([]rune(row.Note)) > 1000 {
			return &RulesValidationError{Message: "Пояснение: не более 1000 символов"}
		}
	}
	return nil
}

func (s *Store) AttachItemCompatibility(ctx context.Context, items []Item, userID *int64) ([]Item, error) {
	if len(items) == 0 {
		return items, nil
	}
	ids := make([]int64, len(items))
	byID := map[int64]int{}
	for i := range items {
		ids[i] = items[i].ID
		byID[ids[i]] = i
		items[i].Compatibility = []ItemCompatibility{}
	}
	rows, err := s.pool.Query(ctx, `SELECT i.id,c.source_version_id,COALESCE(v.version,''),COALESCE(c.status,''),
 CASE WHEN r.user_id IS NULL OR r.user_id=$2 THEN c.replaced_by_item_id END,c.adapter_code,COALESCE(c.note,''),
 CASE WHEN origin.user_id IS NULL OR origin.user_id=$2 THEN i.derived_from_item_id END,i.derivation_kind
 FROM dndshare.item i LEFT JOIN dndshare.item_version_compatibility c ON c.item_id=i.id LEFT JOIN dndshare.source_version v ON v.id=c.source_version_id
 LEFT JOIN dndshare.item origin ON origin.id=i.derived_from_item_id
 LEFT JOIN dndshare.item r ON r.id=c.replaced_by_item_id
 WHERE i.id=ANY($1) ORDER BY c.source_version_id`, ids, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var id int64
		var c ItemCompatibility
		var edition, origin *int64
		var kind *string
		if err = rows.Scan(&id, &edition, &c.Version, &c.Status, &c.ReplacedByItemID, &c.AdapterCode, &c.Note, &origin, &kind); err != nil {
			return nil, err
		}
		i := byID[id]
		items[i].DerivedFromItemID = origin
		items[i].DerivationKind = kind
		if edition != nil {
			c.SourceVersionID = *edition
			items[i].Compatibility = append(items[i].Compatibility, c)
		}
	}
	return items, rows.Err()
}

func setItemCompatibility(ctx context.Context, tx pgx.Tx, itemID int64, decisions []ItemCompatibility) error {
	if err := ValidateItemCompatibility(decisions); err != nil {
		return err
	}
	// Serialize graph edits so concurrent A→B / B→A cannot form a cycle.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(1145980229)`); err != nil {
		return err
	}
	for _, c := range decisions {
		var valid bool
		err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.item i
   JOIN dndshare.item_type t ON t.id=i.type_id JOIN dndshare.source_version v ON v.source_id=t.source_id
   WHERE i.id=$1 AND v.id=$2)`, itemID, c.SourceVersionID).Scan(&valid)
		if err != nil {
			return err
		}
		if !valid {
			return &RulesValidationError{Message: "Редакция не принадлежит системе объекта"}
		}

		if c.Selectable() {
			if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.item i WHERE i.id=$1 AND (i.parent_id IS NULL OR EXISTS(SELECT 1 FROM dndshare.item_version_compatibility p WHERE p.item_id=i.parent_id AND p.source_version_id=$2 AND p.status IN ('native','compatible'))))`, itemID, c.SourceVersionID).Scan(&valid); err != nil {
				return err
			}
			if !valid {
				return &RulesValidationError{Message: "Родительская запись недоступна в выбранной редакции"}
			}
		}
		if c.ReplacedByItemID != nil {
			err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.item a
    JOIN dndshare.item_type at ON at.id=a.type_id JOIN dndshare.item b ON b.id=$2
    JOIN dndshare.item_type bt ON bt.id=b.type_id
    JOIN dndshare.item_version_compatibility bc ON bc.item_id=b.id AND bc.source_version_id=$3
    WHERE a.id=$1 AND a.id<>b.id AND at.source_id=bt.source_id AND a.type_id=b.type_id
    AND (b.user_id IS NULL OR b.user_id=a.user_id) AND NOT b.hidden
    AND bc.status IN ('native','compatible'))`, itemID, *c.ReplacedByItemID, c.SourceVersionID).Scan(&valid)
			if err != nil {
				return err
			}
			if !valid {
				return &RulesValidationError{Message: "Замена должна быть доступным объектом того же типа, системы и редакции"}
			}
			var cycle bool
			err = tx.QueryRow(ctx, `WITH RECURSIVE chain(id,path) AS (
    SELECT $2::bigint,ARRAY[$2::bigint] UNION ALL
    SELECT c.replaced_by_item_id,chain.path||c.replaced_by_item_id FROM chain
    JOIN dndshare.item_version_compatibility c ON c.item_id=chain.id AND c.source_version_id=$3
    WHERE c.replaced_by_item_id IS NOT NULL AND NOT c.replaced_by_item_id=ANY(chain.path))
    SELECT EXISTS(SELECT 1 FROM chain WHERE id=$1)`, itemID, *c.ReplacedByItemID, c.SourceVersionID).Scan(&cycle)
			if err != nil {
				return err
			}
			if cycle {
				return &RulesValidationError{Message: "Замены образуют цикл"}
			}
		}
	}

	selectable := []int64{}
	for _, row := range decisions {
		if row.Selectable() {
			selectable = append(selectable, row.SourceVersionID)
		}
	}
	var referenced bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.item_version_compatibility WHERE replaced_by_item_id=$1 AND NOT source_version_id=ANY($2::bigint[]))`, itemID, selectable).Scan(&referenced); err != nil {
		return err
	}
	if referenced {
		return &RulesValidationError{Message: "На эту запись ссылаются прежние версии; сначала обновите их замены"}
	}
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.item i JOIN dndshare.item_version_compatibility c ON c.item_id=i.id WHERE i.parent_id=$1 AND c.status IN ('native','compatible') AND NOT c.source_version_id=ANY($2::bigint[]))`, itemID, selectable).Scan(&referenced); err != nil {
		return err
	}
	if referenced {
		return &RulesValidationError{Message: "Дочерние записи доступны в этой редакции; сначала измените их совместимость"}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.item_version_compatibility WHERE item_id=$1`, itemID); err != nil {
		return err
	}
	for _, c := range decisions {
		if _, err := tx.Exec(ctx, `INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status,replaced_by_item_id,adapter_code,note)
   VALUES($1,$2,$3,$4,NULL,$5)`, itemID, c.SourceVersionID, c.Status, c.ReplacedByItemID, strings.TrimSpace(c.Note)); err != nil {
			return err
		}
	}
	return validateParentEditions(ctx, tx, []int64{itemID})
}

func validateParentEditions(ctx context.Context, tx pgx.Tx, ids []int64) error {
	var invalid bool
	err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.item i JOIN dndshare.item_version_compatibility c ON c.item_id=i.id WHERE i.id=ANY($1) AND i.parent_id IS NOT NULL AND c.status IN ('native','compatible') AND NOT EXISTS(SELECT 1 FROM dndshare.item p JOIN dndshare.item_version_compatibility pc ON pc.item_id=p.id WHERE p.id=i.parent_id AND NOT p.hidden AND (p.user_id IS NULL OR p.user_id=i.user_id) AND pc.source_version_id=c.source_version_id AND pc.status IN ('native','compatible')))`, ids).Scan(&invalid)
	if err != nil {
		return err
	}
	if invalid {
		return &RulesValidationError{Message: "Родительская запись недоступна в редакции дочерней записи"}
	}
	return nil
}

func (s *Store) SetItemCompatibility(ctx context.Context, itemID, userID int64, admin bool, decisions []ItemCompatibility) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(1145980229)`); err != nil {
		return err
	}
	var id int64
	if err = tx.QueryRow(ctx, `SELECT id FROM dndshare.item WHERE id=$1 AND ($3 OR user_id=$2) FOR UPDATE`, itemID, userID, admin).Scan(&id); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if err = setItemCompatibility(ctx, tx, id, decisions); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func initialCompatibility(patch ItemMetadataPatch) []ItemCompatibility {
	if patch.Compatibility == nil {
		return []ItemCompatibility{}
	}
	return *patch.Compatibility
}
