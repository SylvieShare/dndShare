package battlemap

// WaterAnimation modifies painted liquid materials, refined by optional vertex masks.
// It belongs to the logical model, independently of light templates.
type WaterAnimation struct {
	Enabled      bool       `json:"enabled"`
	Speed        float64    `json:"speed"`
	Strength     float64    `json:"strength"`
	Pattern      string     `json:"pattern,omitempty"`
	RoughnessMax float64    `json:"roughnessMax,omitempty"`
	Center       [2]float64 `json:"center"`
}
