package store

import (
	"fmt"
	"strings"
)

type schemaSQLToken struct {
	word  string
	depth int
	start int
}

type schemaSQLStatement struct {
	tokens []schemaSQLToken
	sql    string
}

// Split at real statement boundaries, ignoring comments, quoted identifiers,
// strings and dollar-quoted routine bodies. Quoted text is never a keyword.
func schemaSQLStatements(sql string) ([]schemaSQLStatement, error) {
	var statements []schemaSQLStatement
	var tokens []schemaSQLToken
	depth := 0
	for i := 0; i < len(sql); {
		c := sql[i]
		if c <= ' ' {
			i++
			continue
		}
		if strings.HasPrefix(sql[i:], "--") {
			end := strings.IndexByte(sql[i:], '\n')
			if end < 0 {
				break
			}
			i += end + 1
			continue
		}
		if strings.HasPrefix(sql[i:], "/*") {
			level := 1
			i += 2
			for i < len(sql) && level > 0 {
				switch {
				case strings.HasPrefix(sql[i:], "/*"):
					level++
					i += 2
				case strings.HasPrefix(sql[i:], "*/"):
					level--
					i += 2
				default:
					i++
				}
			}
			if level != 0 {
				return nil, fmt.Errorf("unclosed SQL comment")
			}
			continue
		}
		if c == '\'' || c == '"' {
			end, err := schemaQuotedEnd(sql, i, c)
			if err != nil {
				return nil, err
			}
			tokens = append(tokens, schemaSQLToken{"quoted", depth, i})
			i = end
			continue
		}
		if c == '$' {
			end := i + 1
			for end < len(sql) && (schemaWordByte(sql[end]) && sql[end] != '$') {
				end++
			}
			if end < len(sql) && sql[end] == '$' {
				tag := sql[i : end+1]
				close := strings.Index(sql[end+1:], tag)
				if close < 0 {
					return nil, fmt.Errorf("unclosed SQL dollar quote")
				}
				tokens = append(tokens, schemaSQLToken{"quoted", depth, i})
				i = end + 1 + close + len(tag)
				continue
			}
		}
		if schemaWordByte(c) {
			end := i + 1
			for end < len(sql) && schemaWordByte(sql[end]) {
				end++
			}
			tokens = append(tokens, schemaSQLToken{strings.ToUpper(sql[i:end]), depth, i})
			i = end
			continue
		}
		switch c {
		case '(':
			depth++
		case ')':
			depth--
			if depth < 0 {
				return nil, fmt.Errorf("unbalanced SQL parentheses")
			}
		case ';':
			if depth != 0 {
				return nil, fmt.Errorf("statement separator inside SQL parentheses")
			}
			if len(tokens) > 0 {
				statements = append(statements, schemaSQLStatement{tokens, sql[tokens[0].start : i+1]})
				tokens = nil
			}
		}
		i++
	}
	if depth != 0 {
		return nil, fmt.Errorf("unbalanced SQL parentheses")
	}
	if len(tokens) > 0 {
		statements = append(statements, schemaSQLStatement{tokens, sql[tokens[0].start:]})
	}
	return statements, nil
}

func schemaQuotedEnd(sql string, start int, quote byte) (int, error) {
	escaped := quote == '\'' && start > 0 && (sql[start-1] == 'E' || sql[start-1] == 'e') &&
		(start == 1 || !schemaWordByte(sql[start-2]))
	for i := start + 1; i < len(sql); i++ {
		if escaped && sql[i] == '\\' {
			i++
			continue
		}
		if sql[i] == quote {
			if i+1 < len(sql) && sql[i+1] == quote {
				i++
				continue
			}
			return i + 1, nil
		}
	}
	return 0, fmt.Errorf("unclosed SQL quote")
}

func schemaWordByte(c byte) bool {
	return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' || c == '$'
}
