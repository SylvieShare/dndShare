package store

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/jackc/pgx/v5"
)

func impactEffectPlan(ctx context.Context, tx pgx.Tx, userID, actorID int64, data map[string]any, key, actionID string, applyEffects bool) (ApplicationPlan, error) {
	if key == "" {
		return ApplicationPlan{}, nil
	}
	id := int64(number(object(data["source"])["itemId"]))
	_, source, kind, err := visibleApplicationItem(ctx, tx, id, userID)
	if err != nil {
		return ApplicationPlan{}, err
	}
	if kind != 5 && kind != 19 {
		return ApplicationPlan{}, ErrApplication
	}
	plan, err := buildCatalogueApplication(ctx, tx, map[string]any{"item_id": float64(id)}, key, userID, kind, "impact")
	if err != nil {
		return plan, err
	}
	// Non-spell sources normally apply all links; the DM explicitly chooses one.
	effects := []ApplicationEffect{}
	for _, effect := range plan.Effects {
		if effect.Key == key {
			effects = append(effects, effect)
		}
	}
	if len(effects) != 1 {
		return plan, ErrApplication
	}
	plan.Effects = effects
	plan.Healing = ""
	plan.TemporaryHP = ""
	var raw json.RawMessage
	var uuid string
	if actorID > 0 {
		if err = tx.QueryRow(ctx, `SELECT data,uuid::text FROM dndshare."char" WHERE id=$1 AND NOT deleted FOR UPDATE`, actorID).Scan(&raw, &uuid); err != nil {
			return plan, err
		}
	}
	if kind == 5 {
		doc := transferDocument{"values": map[string]any{}}
		if actorID > 0 {
			doc, err = decodeTransferDocument(raw)
			if err != nil {
				return plan, err
			}
		}
		level := max(number(source["lvl"]), number(data["castLevel"]), number(data["slotLevel"]))
		if level > 9 {
			return plan, ErrApplication
		}
		_, ability := spellCastingReference(doc.values(), id, textValue(data["entryKey"]))
		if err = prepareSpellEffectBindings(&plan, source, doc.values(), level, ability); err != nil {
			return plan, err
		}
		if applyEffects && applicationNeedsConcentration(plan) {
			if actorID == 0 {
				return plan, fmt.Errorf("%w: для концентрации нужен персонаж-заклинатель", ErrApplication)
			}
			current, err := concentrationTx(ctx, tx, actorID)
			if err != nil {
				return plan, err
			}
			saved := textValue(data["impactConcentrationId"])
			if saved != "" && (current == nil || current.ID != saved) {
				return plan, ErrConcentrationExpired
			}
			castID := textValue(data["castId"])
			if castID != "" && (current == nil || current.ID != castID) {
				return plan, ErrConcentrationExpired
			}
			if saved != "" {
				castID = saved
			}
			if castID == "" {
				castID = actionID
			}
			plan.ConcentrationID, err = beginConcentrationTx(ctx, tx, actorID, id, plan.Name, castID, false)
			if err != nil {
				return plan, err
			}
			data["impactConcentrationId"] = plan.ConcentrationID
		}
		plan.CasterUUID = uuid
	}
	return plan, nil
}
