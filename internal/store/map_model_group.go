package store

import "context"

// A section-only edit still compares the variant code so it cannot erase a
// concurrently reviewed family or accept a pre-variant catalogue snapshot.
func (s *Store) UpdateMapModelGroup(ctx context.Context, id, expectedCode, expectedVariantCode, code string) (string, error) {
	err := s.UpdateMapModelGrouping(ctx, []ModelGroupingChange{{DefinitionID: id, ExpectedCode: expectedCode, ExpectedVariantCode: expectedVariantCode, Code: code, VariantCode: expectedVariantCode}})
	if err != nil {
		return "", err
	}
	return code, nil
}
