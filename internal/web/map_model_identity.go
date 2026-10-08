package web

import "encoding/json"

// Logical identity and its stable internal UUID are independent of asset updates.
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
	fields["uuid"], _ = json.Marshal(m.ID)
	delete(fields, "definitionId")
	return json.Marshal(fields)
}
