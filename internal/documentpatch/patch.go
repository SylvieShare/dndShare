// Package documentpatch is the shared JSON document mutation contract. Paths
// address collection entries by stable identity, never by a moving array index.
package documentpatch

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
)

var ErrPatch = errors.New("invalid document patch")

type Selector struct {
	IDField string `json:"idField"`
	ID      any    `json:"id"`
}
type Operation struct {
	Op       string          `json:"op"`
	Path     []any           `json:"path"`
	Value    json.RawMessage `json:"value,omitempty"`
	IDField  string          `json:"idField,omitempty"`
	BeforeID json.RawMessage `json:"beforeId,omitempty"`
}

func (op *Operation) UnmarshalJSON(data []byte) error {
	type wire Operation
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	return decoder.Decode((*wire)(op))
}
func Decode(raw []byte) (any, error) {
	var value any
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&value); err != nil {
		return nil, err
	}
	return value, nil
}
func Equal(a, b any) bool {
	switch a := a.(type) {
	case nil:
		return b == nil
	case string:
		other, ok := b.(string)
		return ok && a == other
	case bool:
		other, ok := b.(bool)
		return ok && a == other
	case map[string]any:
		b, ok := b.(map[string]any)
		if !ok || len(a) != len(b) {
			return false
		}
		for key, value := range a {
			other, ok := b[key]
			if !ok || !Equal(value, other) {
				return false
			}
		}
		return true
	case []any:
		b, ok := b.([]any)
		if !ok || len(a) != len(b) {
			return false
		}
		for i, value := range a {
			if !Equal(value, b[i]) {
				return false
			}
		}
		return true
	case json.Number:
		b, ok := b.(json.Number)
		if !ok {
			return false
		}
		if a == b {
			return true
		}
		x, xOK := new(big.Rat).SetString(string(a))
		y, yOK := new(big.Rat).SetString(string(b))
		return xOK && yOK && x.Cmp(y) == 0
	default:
		return fmt.Sprintf("%T:%v", a, a) == fmt.Sprintf("%T:%v", b, b)
	}
}
func safe(key string) bool { return key != "__proto__" && key != "prototype" && key != "constructor" }
func selector(value any) (Selector, bool) {
	if typed, ok := value.(Selector); ok {
		return typed, typed.IDField != "" && safe(typed.IDField) && validID(typed.ID)
	}
	fields, ok := value.(map[string]any)
	if !ok {
		return Selector{}, false
	}
	key, ok := fields["idField"].(string)
	return Selector{key, fields["id"]}, ok && key != "" && safe(key) && validID(fields["id"])
}
func validID(value any) bool {
	switch value.(type) {
	case string, json.Number:
		return true
	}
	return false
}
func find(list []any, sel Selector) (int, error) {
	found := -1
	for i, item := range list {
		if fields, ok := item.(map[string]any); ok && Equal(fields[sel.IDField], sel.ID) {
			if found >= 0 {
				return -1, ErrPatch
			}
			found = i
		}
	}
	return found, nil
}

// Apply works on a decoded private copy. A failed batch cannot alter the input.
func Apply(raw json.RawMessage, operations []Operation) (json.RawMessage, error) {
	if len(operations) > 10000 {
		return nil, ErrPatch
	}
	value, err := Decode(raw)
	if err != nil {
		return nil, ErrPatch
	}
	for _, op := range operations {
		if len(op.Path) > 64 {
			return nil, ErrPatch
		}
		value, err = apply(value, op.Path, op)
		if err != nil {
			return nil, fmt.Errorf("%w: %s", ErrPatch, err)
		}
	}
	return json.Marshal(value)
}
func apply(node any, path []any, op Operation) (any, error) {
	if len(path) == 0 {
		if op.Op == "set" {
			if op.Value == nil {
				return nil, ErrPatch
			}
			return Decode(op.Value)
		}
		if op.Op == "order" {
			return reorder(node, op)
		}
		return nil, ErrPatch
	}
	part := path[0]
	if key, ok := part.(string); ok {
		object, ok := node.(map[string]any)
		if !ok || !safe(key) {
			return nil, ErrPatch
		}
		child, exists := object[key]
		if len(path) == 1 && op.Op == "remove" {
			if !exists {
				return nil, ErrPatch
			}
			delete(object, key)
			return object, nil
		}
		if !exists && !(len(path) == 1 && op.Op == "set") {
			return nil, ErrPatch
		}
		updated, err := apply(child, path[1:], op)
		if err != nil {
			return nil, err
		}
		object[key] = updated
		return object, nil
	}
	sel, ok := selector(part)
	list, isList := node.([]any)
	if !ok || !isList {
		return nil, ErrPatch
	}
	index, err := find(list, sel)
	if err != nil {
		return nil, err
	}
	if len(path) == 1 && op.Op == "insert" {
		if index >= 0 {
			return nil, ErrPatch
		}
		value, err := Decode(op.Value)
		if err != nil {
			return nil, err
		}
		fields, ok := value.(map[string]any)
		if !ok || !Equal(fields[sel.IDField], sel.ID) {
			return nil, ErrPatch
		}
		at := len(list)
		if op.BeforeID != nil {
			id, err := Decode(op.BeforeID)
			if err != nil {
				return nil, err
			}
			at, err = find(list, Selector{sel.IDField, id})
			if err != nil || at < 0 {
				return nil, ErrPatch
			}
		}
		list = append(list, nil)
		copy(list[at+1:], list[at:])
		list[at] = value
		return list, nil
	}
	if index < 0 {
		return nil, ErrPatch
	}
	if len(path) == 1 && op.Op == "remove" {
		return append(list[:index], list[index+1:]...), nil
	}
	updated, err := apply(list[index], path[1:], op)
	if err != nil {
		return nil, err
	}
	list[index] = updated
	return list, nil
}
func reorder(node any, op Operation) (any, error) {
	list, ok := node.([]any)
	if !ok || op.IDField == "" || !safe(op.IDField) {
		return nil, ErrPatch
	}
	order, err := Decode(op.Value)
	if err != nil {
		return nil, err
	}
	ids, ok := order.([]any)
	if !ok || len(ids) != len(list) {
		return nil, ErrPatch
	}
	result := make([]any, 0, len(list))
	seen := map[int]bool{}
	for _, id := range ids {
		index, err := find(list, Selector{op.IDField, id})
		if err != nil || index < 0 || seen[index] {
			return nil, ErrPatch
		}
		seen[index] = true
		result = append(result, list[index])
	}
	return result, nil
}
