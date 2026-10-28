package documentpatch

// Lookup uses the same selector semantics as Apply. Missing entries are distinct
// from JSON null; duplicate identities and unsafe path parts are invalid.
func Lookup(node any, path []any) (any, bool, error) {
	if len(path) == 0 || len(path) > 64 {
		return nil, false, ErrPatch
	}
	for _, part := range path {
		switch key := part.(type) {
		case string:
			if !safe(key) {
				return nil, false, ErrPatch
			}
			object, ok := node.(map[string]any)
			if !ok {
				return nil, false, nil
			}
			node, ok = object[key]
			if !ok {
				return nil, false, nil
			}
		default:
			sel, ok := selector(part)
			if !ok {
				return nil, false, ErrPatch
			}
			list, ok := node.([]any)
			if !ok {
				return nil, false, nil
			}
			index, err := find(list, sel)
			if err != nil {
				return nil, false, err
			}
			if index < 0 {
				return nil, false, nil
			}
			node = list[index]
		}
	}
	return node, true, nil
}
