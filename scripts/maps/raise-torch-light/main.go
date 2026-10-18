// Explicit, atomic data operation; preview by default. The document contract is unchanged.
package main

import (
	"context"
	"dndshare/internal/battlemap"
	"dndshare/internal/config"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/jackc/pgx/v5"
	"math"
	"os"
	"time"
)

func main() {
	apply := flag.Bool("apply", false, "apply the verified height adjustment")
	backup := flag.String("backup", "torch-height-before.json", "server-side backup path")
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
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	connection, err := pgx.ParseConfig(cfg.DSN)
	if err != nil {
		return err
	}
	connection.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	db, err := pgx.ConnectConfig(ctx, connection)
	if err != nil {
		return err
	}
	defer db.Close(ctx)
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	lock := ""
	if apply {
		lock = " FOR UPDATE"
	}
	var raw json.RawMessage
	if err = tx.QueryRow(ctx, `SELECT default_lights FROM dndshare.map_model_definition WHERE id=$1`+lock, definitionID).Scan(&raw); err != nil {
		return err
	}
	var lights []battlemap.ModelLight
	if err = json.Unmarshal(raw, &lights); err != nil {
		return err
	}
	index := -1
	for i, l := range lights {
		if l.Key == lightKey {
			index = i
		}
	}
	if index < 0 {
		return fmt.Errorf("Torch light template is missing")
	}
	template := lights[index]
	if math.Abs(template.Position[2]-newHeight) < 1e-8 {
		fmt.Println(`{"alreadyApplied":true,"lights":0}`)
		return nil
	}
	if math.Abs(template.Position[2]-oldHeight) > 1e-8 || template.Effect == nil {
		return fmt.Errorf("Torch height changed; inspect before applying")
	}
	rows, err := tx.Query(ctx, `SELECT id::text FROM dndshare.map_model WHERE definition_id=$1`, definitionID)
	if err != nil {
		return err
	}
	modelIDs := map[string]bool{}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		modelIDs[id] = true
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return err
	}
	type document struct {
		Table, ID string
		Before    json.RawMessage
		After     json.RawMessage `json:"-"`
	}
	documents := []document{}
	count := 0
	for _, table := range []string{"battle_map", "session_map"} {
		rows, err = tx.Query(ctx, `SELECT id::text,document FROM dndshare.`+table+` ORDER BY id`+lock)
		if err != nil {
			return err
		}
		batch := []document{}
		for rows.Next() {
			var d document
			d.Table = table
			if err = rows.Scan(&d.ID, &d.Before); err != nil {
				rows.Close()
				return err
			}
			batch = append(batch, d)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return err
		}
		for _, d := range batch {
			after, n, e := shiftDocument(d.Before, modelIDs, template)
			if e != nil {
				return fmt.Errorf("%s %s: %w", table, d.ID, e)
			}
			if n > 0 {
				d.After = after
				documents = append(documents, d)
				count += n
			}
		}
	}
	lights[index].Position[2] = newHeight
	lights[index].Effect = battlemap.ScaleLightEffect(template.Effect, 1)
	lights[index].Effect.Offset[2] -= newHeight - oldHeight
	if err = battlemap.ValidateModelBehaviour(battlemap.ModelBehaviour{Revision: 1, DefaultLights: lights}); err != nil {
		return err
	}
	after, err := json.Marshal(lights)
	if err != nil {
		return err
	}
	if apply {
		data, e := json.MarshalIndent(map[string]any{"templateBefore": raw, "documents": documents}, "", "  ")
		if e != nil {
			return e
		}
		file, e := os.OpenFile(backup, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
		if e != nil {
			return e
		}
		_, e = file.Write(data)
		closeErr := file.Close()
		if e != nil {
			return e
		}
		if closeErr != nil {
			return closeErr
		}
		if _, err = tx.Exec(ctx, `UPDATE dndshare.map_model_definition SET default_lights=$2::jsonb,revision=revision+1 WHERE id=$1`, definitionID, json.RawMessage(after)); err != nil {
			return err
		}
		for _, d := range documents {
			if _, err = tx.Exec(ctx, `UPDATE dndshare.`+d.Table+` SET document=$2::jsonb,revision=revision+1,changed_at=now() WHERE id=$1::uuid`, d.ID, d.After); err != nil {
				return err
			}
		}
		if err = tx.Commit(ctx); err != nil {
			return err
		}
	}
	fmt.Printf("{\"applied\":%t,\"maps\":%d,\"lights\":%d,\"sourceHeight\":2.2,\"flamePreserved\":true}\n", apply, len(documents), count)
	return nil
}
