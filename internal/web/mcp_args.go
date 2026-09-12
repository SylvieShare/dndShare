package web

import (
	"encoding/json"
	"fmt"
	"strings"
)

func rawArg(args map[string]json.RawMessage, key string) (json.RawMessage, bool) {
	v, ok := args[key]
	if !ok || len(v) == 0 || string(v) == "null" {
		return nil, false
	}
	return v, true
}

func argInt64(args map[string]json.RawMessage, key string) (int64, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return 0, fmt.Errorf("missing required parameter %q", key)
	}
	var v int64
	if err := json.Unmarshal(raw, &v); err != nil {
		return 0, fmt.Errorf("parameter %q must be an integer", key)
	}
	return v, nil
}

func argInt64Opt(args map[string]json.RawMessage, key string) (*int64, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return nil, nil
	}
	var v int64
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, fmt.Errorf("parameter %q must be an integer", key)
	}
	return &v, nil
}

func argIntDefault(args map[string]json.RawMessage, key string, def int) (int, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return def, nil
	}
	var v int
	if err := json.Unmarshal(raw, &v); err != nil {
		return 0, fmt.Errorf("parameter %q must be an integer", key)
	}
	return v, nil
}

func argBoolDefault(args map[string]json.RawMessage, key string, def bool) (bool, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return def, nil
	}
	var v bool
	if err := json.Unmarshal(raw, &v); err != nil {
		return false, fmt.Errorf("parameter %q must be a boolean", key)
	}
	return v, nil
}

func argInt64Slice(args map[string]json.RawMessage, key string) ([]int64, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return nil, fmt.Errorf("missing required parameter %q", key)
	}
	var v []int64
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, fmt.Errorf("parameter %q must be an array of integers", key)
	}
	return v, nil
}

func argInt64SliceDefault(args map[string]json.RawMessage, key string, def []int64) ([]int64, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return def, nil
	}
	var v []int64
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, fmt.Errorf("parameter %q must be an array of integers", key)
	}
	return v, nil
}

func argString(args map[string]json.RawMessage, key string) (string, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return "", fmt.Errorf("missing required parameter %q", key)
	}
	var v string
	if err := json.Unmarshal(raw, &v); err != nil {
		return "", fmt.Errorf("parameter %q must be a string", key)
	}
	return v, nil
}

func argStringOpt(args map[string]json.RawMessage, key string) (*string, error) {
	raw, ok := rawArg(args, key)
	if !ok {
		return nil, nil
	}
	var v string
	if err := json.Unmarshal(raw, &v); err != nil {
		return nil, fmt.Errorf("parameter %q must be a string", key)
	}
	return &v, nil
}

func parseMcpData(s string) (json.RawMessage, error) {
	if strings.TrimSpace(s) == "" {
		return json.RawMessage("{}"), nil
	}
	var m map[string]any
	if err := json.Unmarshal([]byte(s), &m); err != nil {
		return nil, fmt.Errorf("data must be a JSON object: %w", err)
	}
	raw, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	return raw, nil
}
