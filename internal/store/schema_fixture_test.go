package store

import (
	"context"
	"fmt"
	"os"
	"regexp"
	"strings"
	"testing"

	"dndshare/internal/battlemap"
	"dndshare/internal/testdb"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Current-schema feature fixtures share the same migrations as the HTTP tests.
func currentSchemaTestPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	pool := testdb.Pool(t)
	if err := applySchema(t.Context(), pool); err != nil {
		t.Fatal(err)
	}
	schemaTestExec(t, pool, `INSERT INTO dndshare.source(id,name) VALUES(1,'DND5e'); INSERT INTO dndshare.source_version(id,source_id,version) VALUES(1,1,'2014')`)
	return pool
}

func seedTestUsers(t *testing.T, pool *pgxpool.Pool, ids ...int64) {
	t.Helper()
	for _, id := range ids {
		schemaTestExec(t, pool, `INSERT INTO dndshare.users(id,login,password) VALUES($1,$2,'test')`, id, fmt.Sprintf("user-%d", id))
	}
}

func seedTestItemTypes(t *testing.T, pool *pgxpool.Pool, ids ...int64) {
	t.Helper()
	for _, id := range ids {
		schemaTestExec(t, pool, `INSERT INTO dndshare.item_type(id,name,source_id,fields) VALUES($1,$2,1,'[]')`, id, fmt.Sprintf("Type %d", id))
	}
}

func seedTestImages(t *testing.T, pool *pgxpool.Pool, ids ...int64) {
	t.Helper()
	for _, id := range ids {
		schemaTestExec(t, pool, `INSERT INTO dndshare.storage_image(id,url) VALUES($1,$2)`, id, fmt.Sprintf("/test/%d.webp", id))
	}
}

func testItemFields(t *testing.T, typeID int) string {
	t.Helper()
	data, err := os.ReadFile(fmt.Sprintf("../../resources/items/item_%d_shema.json", typeID))
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

func testSessionSettingsJSON(t *testing.T) string {
	t.Helper()
	pattern := regexp.MustCompile(`(?m)^    settings jsonb DEFAULT '([^']+)'::jsonb`)
	match := pattern.FindStringSubmatch(testSchemaTable(t, "session"))
	if match == nil {
		t.Fatal("current session settings default not found")
	}
	return match[1]
}

func seedSessionOccurrencesForTest(t *testing.T, s *Store, sessionID int64) {
	t.Helper()
	ctx := context.Background()
	for i, name := range []string{"Начало", "Хаммер", "Финал", "Неточная дата"} {
		date := ""
		if i == 0 {
			date = "2026-09-01"
		} else if i == 2 {
			date = "2026-10-03"
		}
		var scheduled any
		if date != "" {
			scheduled = date
		}
		var id int64
		err := s.pool.QueryRow(ctx, `INSERT INTO dndshare.session_occurrence(session_id,number,name,scheduled_on) VALUES($1,$2,$3,$4::date) RETURNING id`, sessionID, i+1, name, scheduled).Scan(&id)
		if err != nil {
			t.Fatal(err)
		}
		journal, err := s.GetSessionJournal(ctx, sessionID)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := s.pool.Exec(ctx, `INSERT INTO dndshare.journal_section(journal_id,position,occurrence_id) VALUES($1,$2,$3)`, journal.ID, i+1, id); err != nil {
			t.Fatal(err)
		}
		meetings, err := s.ListSessionOccurrences(ctx, sessionID)
		if err != nil {
			t.Fatal(err)
		}
		for _, meeting := range meetings {
			if meeting.ID == id {
				if _, err := s.CreateJournalEntry(ctx, journal.ID, meeting.SectionID, 1, JournalEntryMutation{Type: "event", Title: "Сохрани меня"}); err != nil {
					t.Fatal(err)
				}
			}
		}
	}
}

func seedMapModelsForTest(t *testing.T, s *Store) {
	t.Helper()
	for _, model := range battlemap.InitialCatalogue() {
		if _, err := s.RegisterMapModel(context.Background(), model); err != nil {
			t.Fatal(err)
		}
	}
}

// Feature integration tests use current DDL for their subject tables and small
// explicit stubs for unrelated tables. No historical migration or data seed is
// replayed to arrange a feature test.
func testSchemaStatements(t *testing.T) []schemaSQLStatement {
	t.Helper()
	var result []schemaSQLStatement
	for _, part := range schemaParts {
		statements, err := schemaSQLStatements(part.sql)
		if err != nil {
			t.Fatal(err)
		}
		result = append(result, statements...)
	}
	return result
}

func testSchemaFunctions(t *testing.T) string {
	t.Helper()
	result := []string{"SET check_function_bodies=false;"}
	for _, statement := range testSchemaStatements(t) {
		if strings.HasPrefix(statement.sql, "CREATE FUNCTION ") {
			result = append(result, strings.Replace(statement.sql, "CREATE FUNCTION ", "CREATE OR REPLACE FUNCTION ", 1))
		}
	}
	return strings.Join(append(result, "SET check_function_bodies=true;"), "\n")
}

func testSchemaTables(t *testing.T, tables ...string) string {
	t.Helper()
	selected := make(map[string]bool, len(tables))
	for _, table := range tables {
		selected[table] = true
	}
	statements := testSchemaStatements(t)
	sequenceOwners := map[string]string{}
	owned := regexp.MustCompile(`^ALTER SEQUENCE dndshare\."?(\w+)"? OWNED BY dndshare\."?(\w+)"?\.`)
	for _, statement := range statements {
		if match := owned.FindStringSubmatch(statement.sql); match != nil {
			sequenceOwners[match[1]] = match[2]
		}
	}
	target := regexp.MustCompile(`^(?:CREATE TABLE|ALTER TABLE(?: ONLY)?|CREATE SEQUENCE|ALTER SEQUENCE) dndshare\."?(\w+)"?`)
	onTable := regexp.MustCompile(`\bON dndshare\."?(\w+)"?`)
	result := []string{"CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;", testSchemaFunctions(t)}
	for _, statement := range statements {
		name := ""
		if match := target.FindStringSubmatch(statement.sql); match != nil {
			name = match[1]
			if owner, ok := sequenceOwners[name]; ok {
				name = owner
			}
		} else if strings.HasPrefix(statement.sql, "CREATE INDEX ") || strings.HasPrefix(statement.sql, "CREATE UNIQUE INDEX ") || strings.HasPrefix(statement.sql, "CREATE TRIGGER ") {
			if match := onTable.FindStringSubmatch(statement.sql); match != nil {
				name = match[1]
			}
		}
		if selected[name] {
			result = append(result, statement.sql)
		}
	}
	return strings.Join(result, "\n")
}

func testSchemaTable(t *testing.T, table string) string {
	t.Helper()
	pattern := regexp.MustCompile(`^CREATE TABLE dndshare\."?` + regexp.QuoteMeta(table) + `"? \(`)
	for _, statement := range testSchemaStatements(t) {
		if pattern.MatchString(statement.sql) {
			return statement.sql
		}
	}
	t.Fatalf("current table DDL not found: %s", table)
	return ""
}

func testSchemaColumns(t *testing.T, table string, columns ...string) string {
	t.Helper()
	definition := testSchemaTable(t, table)
	var result []string
	for _, column := range columns {
		pattern := regexp.MustCompile(`(?m)^    (` + regexp.QuoteMeta(column) + ` [^\n]+)`)
		match := pattern.FindStringSubmatch(definition)
		if match == nil {
			t.Fatalf("current column DDL not found: %s.%s", table, column)
		}
		result = append(result, fmt.Sprintf(`ALTER TABLE dndshare.%q ADD COLUMN %s;`, table, strings.TrimSuffix(match[1], ",")))
	}
	return strings.Join(result, "\n")
}

func testSchemaChecks(t *testing.T, table string, constraints ...string) string {
	t.Helper()
	definition := testSchemaTable(t, table)
	var result []string
	for _, constraint := range constraints {
		start := strings.Index(definition, "    CONSTRAINT "+constraint+" CHECK ")
		if start < 0 {
			t.Fatalf("current check constraint not found: %s", constraint)
		}
		end := strings.Index(definition[start:], "\n    CONSTRAINT ")
		if end < 0 {
			end = strings.LastIndex(definition, "\n);") - start
		}
		body := strings.TrimSuffix(strings.TrimSpace(definition[start:start+end]), ",")
		result = append(result, fmt.Sprintf(`ALTER TABLE dndshare.%q ADD %s;`, table, body))
	}
	return strings.Join(result, "\n")
}

func testSchemaTriggers(t *testing.T, function string) string {
	t.Helper()
	var result []string
	for _, statement := range testSchemaStatements(t) {
		if strings.HasPrefix(statement.sql, "CREATE TRIGGER ") && strings.Contains(statement.sql, "EXECUTE FUNCTION dndshare."+function+"(") {
			result = append(result, statement.sql)
		}
	}
	if len(result) == 0 {
		t.Fatalf("current triggers not found: %s", function)
	}
	return strings.Join(result, "\n")
}
