package web

import "encoding/json"

// Catalogue identity is logical; immutable asset UUIDs are explicitly versionId.
func (m mapModelView) MarshalJSON() ([]byte, error) {
	type wire mapModelView
	data, err := json.Marshal(wire(m))
	if err != nil {
		return nil, err
	}
	var fields map[string]json.RawMessage
	if err = json.Unmarshal(data, &fields); err != nil {
		return nil, err
	}
	fields["id"], _ = json.Marshal(m.DefinitionID)
	fields["versionId"], _ = json.Marshal(m.ID)
	delete(fields, "definitionId")
	return json.Marshal(fields)
}
