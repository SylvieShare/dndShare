package store

import (
	"context"
	"dndshare/internal/battlemap"
	"fmt"
)

func (s *Store) PrepareMapDocument(ctx context.Context, d *battlemap.Document) error {
	models, err := s.MapModelsForDocument(ctx, *d)
	if err != nil {
		return err
	}
	behaviours, err := s.MapModelBehaviours(ctx)
	if err != nil {
		return err
	}
	if err = battlemap.SyncBuiltinLights(d, models, behaviours); err != nil {
		return fmt.Errorf("%w: %s", ErrInvalidMapModels, err)
	}
	if err = battlemap.ValidateDocument(d); err != nil {
		return fmt.Errorf("%w: %s", ErrInvalidMapModels, err)
	}
	return nil
}

// Read hydration gives existing maps embedded sources without rewriting their
// documents or timestamps. Source IDs remain deterministic until persisted.
func (s *Store) HydrateMapLights(ctx context.Context, documents ...*battlemap.Document) error {
	if len(documents) == 0 {
		return nil
	}
	_, _, err := s.HydrateMapCatalogue(ctx, documents...)
	return err
}

func (s *Store) HydrateMapCatalogue(ctx context.Context, documents ...*battlemap.Document) ([]battlemap.Model, map[string]battlemap.ModelBehaviour, error) {
	catalogue, err := s.ListMapModels(ctx)
	if err != nil {
		return nil, nil, err
	}
	models := map[string]battlemap.ModelMetadata{}
	for _, m := range catalogue {
		models[m.ID] = m.ModelMetadata
	}
	behaviours, err := s.MapModelBehaviours(ctx)
	if err != nil {
		return nil, nil, err
	}
	for _, d := range documents {
		expected := map[string]bool{}
		add := func(kind, id, modelID string) {
			for _, l := range behaviours[models[modelID].DefinitionID].DefaultLights {
				expected[kind+":"+id+":"+l.Key] = true
			}
		}
		for _, t := range d.Tiles {
			add("tile", t.ID, t.ModelID)
		}
		for _, o := range d.Objects {
			add("object", o.ID, o.ModelID)
		}
		lights := []battlemap.Light{}
		for _, l := range d.Lights {
			if l.BuiltinKey == "" || l.Anchor != nil && expected[l.Anchor.Kind+":"+l.Anchor.ID+":"+l.BuiltinKey] {
				lights = append(lights, l)
			}
		}
		d.Lights = lights
		if err = battlemap.SyncBuiltinLights(d, models, behaviours); err != nil {
			return nil, nil, err
		}
	}
	return catalogue, behaviours, nil
}

func (s *Store) HydrateSessionMapLights(ctx context.Context, maps ...*SessionMap) error {
	documents := make([]*battlemap.Document, 0, len(maps))
	for _, m := range maps {
		documents = append(documents, &m.Document)
	}
	return s.HydrateMapLights(ctx, documents...)
}
