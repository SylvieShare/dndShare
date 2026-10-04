package store

import (
	"context"
	"github.com/jackc/pgx/v5"
)

func karmicSequenceAttack(ctx context.Context, tx pgx.Tx, sessionID int64, settings SessionKarmicDiceSettings, key, name string, seq map[string]any, mode string) (map[string]any, error) {
	d20, err := rollSessionD20Tx(ctx, tx, sessionID, settings, key, name, mode, nil)
	if err != nil {
		return nil, err
	}
	index := 0
	result, err := sequenceAttack(seq, mode, func(sides int) (int, error) {
		if sides == 20 && index < len(d20.Rolls) {
			face := d20.Rolls[index]
			index++
			return face, nil
		}
		return secureApplicationDie(sides)
	})
	if err != nil {
		return nil, err
	}
	if d20.Karmic {
		result["karmicDice"] = map[string]any{"before": d20.BalanceBefore, "after": d20.BalanceAfter}
	}
	return result, nil
}
