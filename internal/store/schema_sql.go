package store

import "fmt"

// Migration files can define database objects, including runtime functions and
// triggers. They cannot execute business-data changes, anonymous blocks, or
// queries that materialize rows. Ledger writes live exclusively in schema.go.
func validateSchemaDDL(sql string) error {
	statements, err := schemaSQLStatements(sql)
	if err != nil {
		return err
	}
	for _, statement := range statements {
		tokens := statement.tokens
		if len(tokens) == 0 {
			continue
		}
		switch tokens[0].word {
		case "CREATE", "ALTER", "DROP", "COMMENT":
		default:
			return fmt.Errorf("only structural DDL is allowed, found %q", tokens[0].word)
		}
		if tokens[0].word == "CREATE" {
			table, materialized, creating := false, false, false
			for _, token := range tokens {
				if token.depth != 0 {
					continue
				}
				if token.word == "CREATE" {
					creating = true
					continue
				}
				if creating {
					switch token.word {
					case "OR", "REPLACE", "TEMP", "TEMPORARY", "UNLOGGED", "GLOBAL", "LOCAL":
						continue
					case "TABLE":
						table = true
					case "MATERIALIZED":
						materialized = true
					}
					creating = false
				}
				if table && token.word == "AS" {
					return fmt.Errorf("CREATE TABLE AS populates data and is not allowed")
				}
			}
			if materialized {
				n := len(tokens)
				if n < 3 || tokens[n-3].word != "WITH" || tokens[n-2].word != "NO" || tokens[n-1].word != "DATA" {
					return fmt.Errorf("materialized views must use WITH NO DATA")
				}
			}
		}
		if len(tokens) > 2 && tokens[0].word == "ALTER" && tokens[1].word == "SEQUENCE" {
			for _, token := range tokens {
				if token.word == "RESTART" {
					return fmt.Errorf("resetting stored sequence values is not allowed")
				}
			}
		}
	}
	return nil
}
