package battlemap

// Merging preserves placement IDs and moves the old light switch into a flag.
func MergeLitVariant(d *Document, from, to, flagKey, lightKey string, models map[string]ModelMetadata, behaviours map[string]ModelBehaviour) (int, error) {
	states := map[LightAnchor]bool{}
	defaultEnabled := false
	for _, l := range behaviours[models[from].DefinitionID].DefaultLights {
		if l.Key == lightKey {
			defaultEnabled = l.Enabled
		}
	}
	remember := func(a LightAnchor) {
		enabled := defaultEnabled
		for i := range d.Lights {
			l := &d.Lights[i]
			if l.Anchor == nil || *l.Anchor != a || l.BuiltinKey != lightKey {
				continue
			}
			enabled = l.Enabled
			if l.FlagID != "" {
				for _, f := range d.Flags {
					if f.ID == l.FlagID {
						enabled = enabled && f.Enabled
					}
				}
			}
			l.Enabled = true
		}
		states[a] = enabled
	}
	for i := range d.Tiles {
		if d.Tiles[i].ModelID == from {
			remember(LightAnchor{"tile", d.Tiles[i].ID})
			d.Tiles[i].ModelID = to
		}
	}
	for i := range d.Objects {
		if d.Objects[i].ModelID == from {
			remember(LightAnchor{"object", d.Objects[i].ID})
			d.Objects[i].ModelID = to
		}
	}
	PruneBuiltinComponents(d, models, behaviours)
	if err := SyncBuiltinLights(d, models, behaviours); err != nil {
		return 0, err
	}
	for i := range d.Flags {
		f := &d.Flags[i]
		if f.BuiltinKey == flagKey && f.Anchor != nil {
			if value, exists := states[*f.Anchor]; exists {
				f.Enabled = value
			}
		}
	}
	if err := ValidateDocument(d); err != nil {
		return 0, err
	}
	if err := ValidateTileModels(*d, models); err != nil {
		return 0, err
	}
	return len(states), nil
}
