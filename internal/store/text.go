package store

import (
	"context"
	"strconv"
	"strings"
)

// TextItem — строка dndshare.dictionary_text (порт model/TextItem.kt).
type TextItem struct {
	Keyset string
	Key    string
	Value  string
}

// FindTextByKeysetsAndLang — все записи словаря по набору keyset и языку
// (порт TextRepository.findAllByKeysetInAndLang). Пустой список keysets → пустой результат.
func (s *Store) FindTextByKeysetsAndLang(ctx context.Context, keysets []string, lang string) ([]TextItem, error) {
	if len(keysets) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(keysets))
	args := make([]any, 0, len(keysets)+1)
	for i, ks := range keysets {
		placeholders[i] = "$" + strconv.Itoa(i+1)
		args = append(args, ks)
	}
	args = append(args, lang)
	query := `SELECT keyset, "key", value FROM dndshare.dictionary_text
	          WHERE keyset IN (` + strings.Join(placeholders, ", ") + `) AND lang = $` + strconv.Itoa(len(keysets)+1)
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TextItem
	for rows.Next() {
		var it TextItem
		if err := rows.Scan(&it.Keyset, &it.Key, &it.Value); err != nil {
			return nil, err
		}
		out = append(out, it)
	}
	return out, rows.Err()
}
