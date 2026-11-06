// An explicit catalogue operation. Only editor field definitions are updated.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"reflect"
	"time"

	"dndshare/internal/config"
	"github.com/jackc/pgx/v5"
)

type field = map[string]any

func named(rows []any, property, name string) field {
	for _, raw := range rows {
		f, _ := raw.(map[string]any)
		if f[property] == name {
			return f
		}
	}
	return nil
}

func rows(f field, key string) []any {
	result, _ := f[key].([]any)
	return result
}

// Copy only absent entries. Existing labels, defaults, option order and unrelated fields belong to the catalogue.
func extend(target field, key string, from []any, property string, names []string) {
	existing := rows(target, key)
	for _, name := range names {
		value := named(from, property, name)
		if value != nil && named(existing, property, name) == nil {
			existing = append(existing, value)
		}
	}
	target[key] = existing
}

func update(schema []any, id int, class []any) ([]any, error) {
	if id == 7 {
		rule := named(schema, "key", "derived_effects")
		prototype := named(class, "key", "derived_effects")
		kind := named(rows(rule, "fields"), "key", "kind")
		kinds := rows(named(rows(prototype, "fields"), "key", "kind"), "options")
		if kind == nil || named(kinds, "value", "language_proficiency") == nil {
			return nil, fmt.Errorf("missing shared proficiency schema")
		}
		extend(kind, "options", kinds, "value", []string{"tool_proficiency", "weapon_proficiency", "armor_proficiency", "language_proficiency"})
		extend(rule, "fields", rows(prototype, "fields"), "key", []string{"target_ids", "skill_ids", "choice_value_prefix", "minimum"})
		if named(schema, "key", "scaling") == nil {
			progression := named(class, "key", "scaling")
			if progression == nil {
				return nil, fmt.Errorf("missing progression schema")
			}
			schema = append(schema, progression)
		}
	}
	var durations []field
	if id == 15 {
		durations = append(durations, named(schema, "key", "duration"))
	}
	links := named(schema, "key", "status_effects")
	if links != nil {
		durations = append(durations, named(rows(links, "fields"), "key", "duration"))
	}
	for _, duration := range durations {
		kind := named(rows(duration, "fields"), "key", "kind")
		if kind == nil {
			return nil, fmt.Errorf("missing duration kind on type %d", id)
		}
		extend(kind, "options", []any{field{"value": "custom", "label": "Особое условие"}}, "value", []string{"custom"})
		extend(duration, "fields", []any{field{"key": "text", "name": "Когда заканчивается", "type": "text",
			"show_on": field{"key": "kind", "value": "custom"}}}, "key", []string{"text"})
	}
	return schema, nil
}

func run(apply, unarmed bool) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	conn, err := pgx.ParseConfig(cfg.DSN)
	if err != nil {
		return err
	}
	conn.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	db, err := pgx.ConnectConfig(ctx, conn)
	if err != nil {
		return err
	}
	defer db.Close(ctx)
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if unarmed {
		return normalizeUnarmed(ctx, tx, apply)
	}
	ids := []int{3, 4, 5, 7, 15, 18, 19}
	before := make(map[int]json.RawMessage)
	all := make(map[int][]any)
	for _, id := range ids {
		query := "SELECT fields FROM dndshare.item_type WHERE id=$1"
		if apply {
			query += " FOR UPDATE"
		}
		var raw json.RawMessage
		if err := tx.QueryRow(ctx, query, id).Scan(&raw); err != nil {
			return err
		}
		before[id] = raw
		var schema []any
		if err := json.Unmarshal(raw, &schema); err != nil {
			return err
		}
		all[id] = schema
	}
	var changed []int
	for _, id := range ids {
		next, err := update(all[id], id, all[4])
		if err != nil {
			return err
		}
		var previous []any
		if err := json.Unmarshal(before[id], &previous); err != nil {
			return err
		}
		if reflect.DeepEqual(previous, next) {
			continue
		}
		changed = append(changed, id)
		if apply {
			raw, err := json.Marshal(next)
			if err != nil {
				return err
			}
			if _, err := tx.Exec(ctx, "UPDATE dndshare.item_type SET fields=$1::jsonb WHERE id=$2", string(raw), id); err != nil {
				return err
			}
		}
	}
	if apply && len(changed) > 0 {
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	fmt.Printf("apply=%t changed types=%v\n", apply, changed)
	return nil
}

func main() {
	apply := flag.Bool("apply", false, "update the affected item type definitions in one transaction")
	unarmed := flag.Bool("unarmed-2014", false, "normalize the base damage of the 2014 catalogue record instead")
	flag.Parse()
	if err := run(*apply, *unarmed); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
