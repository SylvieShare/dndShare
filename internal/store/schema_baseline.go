package store

import (
	"context"
	"crypto/sha256"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

const (
	structuralBaselineCount    = 45
	structuralBaselineDigest   = "c82a7a60f6569f09563666db7031440abb374722d2ac366775f88baddf037b08"
	previousSchemaBoundary     = "static-media-s3"
	previousSchemaBoundaryHash = "2b50a606dfd136b5a420ed293f97deada49cd8846ccc2b6de719d734264e03e3"
)

func validateStructuralBaseline() error {
	hash := sha256.New()
	count := 0
	for _, part := range schemaParts {
		if strings.HasPrefix(part.name, "000_") {
			fmt.Fprintf(hash, "%s\x00%s\n", part.name, schemaChecksum(part.sql))
			count++
		}
	}
	if count != structuralBaselineCount || fmt.Sprintf("%x", hash.Sum(nil)) != structuralBaselineDigest {
		return fmt.Errorf("structural baseline is immutable; append a new DDL migration after 000_ instead")
	}
	return nil
}

// The existing database already has the exported structure. Adopt it only at
// the verified previous release boundary, without executing historical SQL or
// replaying baseline DDL. Old ledger entries remain untouched for auditing.
func adoptStructuralBaseline(ctx context.Context, tx pgx.Tx) error {
	var adopted int
	if err := tx.QueryRow(ctx, `SELECT count(*) FROM dndshare.schema_migration WHERE left(code,4)='000_'`).Scan(&adopted); err != nil {
		return err
	}
	if adopted == structuralBaselineCount {
		return nil
	}
	if adopted != 0 {
		return fmt.Errorf("incomplete structural baseline ledger: %d of %d", adopted, structuralBaselineCount)
	}
	var verified bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM dndshare.schema_migration WHERE code=$1 AND checksum=$2)`,
		previousSchemaBoundary, previousSchemaBoundaryHash).Scan(&verified); err != nil {
		return err
	}
	if !verified {
		return fmt.Errorf("existing database must match the verified pre-baseline release (%s)", previousSchemaBoundary)
	}
	for _, part := range schemaParts {
		if strings.HasPrefix(part.name, "000_") {
			if err := recordSchemaPart(ctx, tx, part); err != nil {
				return fmt.Errorf("record structural baseline %s: %w", part.name, err)
			}
		}
	}
	return nil
}
