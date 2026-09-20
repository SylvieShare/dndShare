// Package battlemap defines the shared, versioned map document and play state.
package battlemap

type Grid struct {
	Visible bool    `json:"visible"`
	OffsetX float64 `json:"offsetX"`
	OffsetY float64 `json:"offsetY"`
}

type Background struct {
	AssetID *int64 `json:"assetId,omitempty"`
	URL     string `json:"url,omitempty"`
}

type Credit struct {
	Author  string `json:"author"`
	Source  string `json:"source"`
	License string `json:"license"`
}

type Rect struct {
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

type Zone struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Cells []int  `json:"cells"`
	Rects []Rect `json:"rects"`
}

type Object struct {
	ID       string  `json:"id"`
	Kind     string  `json:"kind"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Rotation float64 `json:"rotation"`
	Scale    float64 `json:"scale"`
	Open     bool    `json:"open"`
}

type Document struct {
	Version    int               `json:"version"`
	Kind       string            `json:"kind"`
	Width      float64           `json:"width"`
	Height     float64           `json:"height"`
	Grid       Grid              `json:"grid"`
	Background Background        `json:"background"`
	Base       string            `json:"base"`
	Cells      map[string]string `json:"cells"`
	Objects    []Object          `json:"objects"`
	Zones      []Zone            `json:"zones"`
	Credit     *Credit           `json:"credit,omitempty"`
}

type Token struct {
	ID       string  `json:"id"`
	Kind     string  `json:"kind"`
	Ref      string  `json:"ref"`
	Name     string  `json:"name"`
	ImageURL string  `json:"imageUrl,omitempty"`
	Color    string  `json:"color"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
	Size     float64 `json:"size"`
	Hidden   bool    `json:"hidden"`
	Physical bool    `json:"physical"`
}

type State struct {
	Fog               bool              `json:"fog"`
	DefaultVisibility string            `json:"defaultVisibility"`
	Zones             map[string]string `json:"zones"`
	Objects           map[string]bool   `json:"objects"`
	Tokens            []Token           `json:"tokens"`
}

type Camera struct {
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	CellPixels float64 `json:"cellPixels"`
	Rotation   int     `json:"rotation"`
	Fit        bool    `json:"fit"`
}

func InitialState() State {
	return State{Fog: true, DefaultVisibility: "hidden", Zones: map[string]string{}, Objects: map[string]bool{}, Tokens: []Token{}}
}

var Terrains = map[string]bool{
	"stone": true, "slate": true, "wood": true, "earth": true, "grass": true,
	"sand": true, "water": true, "lava": true, "chasm": true,
	"wall-stone": true, "wall-brick": true, "wall-wood": true, "wall-rock": true,
}
var ObjectKinds = map[string]bool{
	"door": true, "double-door": true, "portcullis": true, "barrel": true,
	"crate": true, "table": true, "chest": true, "torch": true,
	"stairs": true, "column": true, "rubble": true, "bridge": true,
}

func Interactive(kind string) bool {
	return kind == "door" || kind == "double-door" || kind == "portcullis" || kind == "chest" || kind == "torch"
}
