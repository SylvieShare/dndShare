// Run with the service stopped, before deploying schema 004. No startup DML.
package main

import (
	"context"
	"dndshare/internal/config"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/jackc/pgx/v5"
	"os"
	"reflect"
	"time"
)

type row struct {
	Table, ID                        string
	Revision                         int
	Lights, Flags, Effects, Document json.RawMessage
}

func main() {
	apply := flag.Bool("apply", false, "apply the conversion in one transaction")
	backup := flag.String("backup", "light-effects-before.json", "backup path (0600)")
	flag.Parse()
	if err := run(*apply, *backup); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func run(apply bool, backup string) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	connection, err := pgx.ParseConfig(cfg.DSN)
	if err != nil {
		return err
	}
	connection.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	conn, err := pgx.ConnectConfig(ctx, connection)
	if err != nil {
		return err
	}
	defer conn.Close(ctx)
	tx, err := conn.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	snapshots := []row{}
	lock := ""
	if apply {
		lock = " FOR UPDATE"
	}
	result, err := tx.Query(ctx, `SELECT id,revision,default_lights,default_flags,default_effects FROM dndshare.map_model_definition ORDER BY id`+lock)
	if err != nil {
		return err
	}
	for result.Next() {
		var r row
		r.Table = "map_model_definition"
		if err = result.Scan(&r.ID, &r.Revision, &r.Lights, &r.Flags, &r.Effects); err != nil {
			result.Close()
			return err
		}
		snapshots = append(snapshots, r)
	}
	err = result.Err()
	result.Close()
	if err != nil {
		return err
	}
	for _, table := range []string{"battle_map", "session_map"} {
		result, err = tx.Query(ctx, `SELECT id::text,revision,document FROM dndshare.`+table+` ORDER BY id`+lock)
		if err != nil {
			return err
		}
		for result.Next() {
			var r row
			r.Table = table
			if err = result.Scan(&r.ID, &r.Revision, &r.Document); err != nil {
				result.Close()
				return err
			}
			snapshots = append(snapshots, r)
		}
		err = result.Err()
		result.Close()
		if err != nil {
			return err
		}
	}
	type change struct {
		row
		after []byte
	}
	changes := []change{}
	for _, r := range snapshots {
		var after []byte
		if r.Table == "map_model_definition" {
			var lights []oldModelLight
			var flags []oldFlag
			var effects []oldEffect
			if err = json.Unmarshal(r.Lights, &lights); err != nil {
				return err
			}
			if err = json.Unmarshal(r.Flags, &flags); err != nil {
				return err
			}
			if err = json.Unmarshal(r.Effects, &effects); err != nil {
				return err
			}
			next, e := convertTemplate(lights, flags, effects)
			if e != nil {
				return fmt.Errorf("model %s: %w", r.ID, e)
			}
			after, err = json.Marshal(next)
		} else {
			after, err = convertDocument(r.Document)
		}
		if err != nil {
			return fmt.Errorf("%s %s: %w", r.Table, r.ID, err)
		}
		// Compare JSON values locally; no query per catalogue entry.
		before := r.Document
		if r.Table == "map_model_definition" {
			before = r.Lights
		}
		var left, right any
		if err = json.Unmarshal(before, &left); err != nil {
			return err
		}
		if err = json.Unmarshal(after, &right); err != nil {
			return err
		}
		same := reflect.DeepEqual(left, right)
		if !same || r.Table == "map_model_definition" && (string(r.Flags) != "[]" || string(r.Effects) != "[]") {
			changes = append(changes, change{r, after})
		}
	}
	if apply {
		data, e := json.MarshalIndent(snapshots, "", "  ")
		if e != nil {
			return e
		}
		f, e := os.OpenFile(backup, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if e != nil {
			return e
		}
		_, e = f.Write(data)
		closeErr := f.Close()
		if e != nil {
			return e
		}
		if closeErr != nil {
			return closeErr
		}
		for _, c := range changes {
			if c.Table == "map_model_definition" {
				_, err = tx.Exec(ctx, `UPDATE dndshare.map_model_definition SET default_lights=CAST($2 AS jsonb),default_flags='[]',default_effects='[]',revision=revision+1 WHERE id=$1`, c.ID, json.RawMessage(c.after))
			} else {
				_, err = tx.Exec(ctx, `UPDATE dndshare.`+c.Table+` SET document=CAST($2 AS jsonb),revision=revision+1,changed_at=now() WHERE id=$1::uuid`, c.ID, json.RawMessage(c.after))
			}
			if err != nil {
				return err
			}
		}
		if err = tx.Commit(ctx); err != nil {
			return err
		}
	}
	fmt.Printf("{\"applied\":%t,\"changed\":%d,\"checked\":%d}\n", apply, len(changes), len(snapshots))
	return nil
}
