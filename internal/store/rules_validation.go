package store

// RulesValidationError describes a user-correctable catalogue or edition conflict.
type RulesValidationError struct{ Message string }

func (e *RulesValidationError) Error() string { return e.Message }
