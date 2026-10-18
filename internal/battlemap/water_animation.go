package battlemap

// WaterAnimation modifies only the measured water surfaces carried by model GLBs.
// It belongs to the logical model, independently of light templates.
type WaterAnimation struct {
	Enabled  bool    `json:"enabled"`
	Speed    float64 `json:"speed"`
	Strength float64 `json:"strength"`
}
