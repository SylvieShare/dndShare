package main

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"

	"github.com/jackc/pgx/v5"
)

func extendAbilityBonus(schema []any) error {
	rule := named(schema, "key", "derived_effects")
	kind := named(rows(rule, "fields"), "key", "kind")
	if kind == nil {
		return fmt.Errorf("missing status derived effect kinds")
	}
	extend(kind, "options", []any{field{"value": "ability_bonus", "label": "Бонус к значению характеристики"}}, "value", []string{"ability_bonus"})
	return nil
}

func installAbilityBonus(ctx context.Context, tx pgx.Tx, apply bool) error {
	query := "SELECT fields FROM dndshare.item_type WHERE id=15"
	if apply {
		query += " FOR UPDATE"
	}
	var original json.RawMessage
	if err := tx.QueryRow(ctx, query).Scan(&original); err != nil {
		return err
	}
	var schema, before []any
	if err := json.Unmarshal(original, &schema); err != nil {
		return err
	}
	if err := json.Unmarshal(original, &before); err != nil {
		return err
	}
	if err := extendAbilityBonus(schema); err != nil {
		return err
	}
	changed := !reflect.DeepEqual(before, schema)
	if apply && changed {
		raw, err := json.Marshal(schema)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, "UPDATE dndshare.item_type SET fields=$1::jsonb WHERE id=15", string(raw)); err != nil {
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	fmt.Printf("apply=%t status ability bonus changed=%t\n", apply, changed)
	return nil
}
