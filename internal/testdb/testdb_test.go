package testdb

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"testing"
)

func TestDatabasesAreIsolated(t *testing.T) {
	first, second := Pool(t), Pool(t)
	for i, pool := range []*pgxpool.Pool{first, second} {
		if _, err := pool.Exec(t.Context(), `CREATE TABLE isolation(value integer); INSERT INTO isolation VALUES($1)`, i); err != nil {
			t.Fatal(err)
		}
	}
	var firstDB, secondDB string
	if err := first.QueryRow(t.Context(), `SELECT current_database()`).Scan(&firstDB); err != nil {
		t.Fatal(err)
	}
	if err := second.QueryRow(t.Context(), `SELECT current_database()`).Scan(&secondDB); err != nil {
		t.Fatal(err)
	}
	if firstDB == secondDB {
		t.Fatal("test databases share state")
	}
	if _, err := first.Exec(t.Context(), `DROP TABLE isolation`); err != nil {
		t.Fatal(err)
	}
	var value int
	if err := second.QueryRow(t.Context(), `SELECT value FROM isolation`).Scan(&value); err != nil || value != 1 {
		t.Fatal(value, err)
	}
}
