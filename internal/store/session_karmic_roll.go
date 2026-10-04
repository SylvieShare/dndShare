package store

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
)

// Caller holds the session row lock; sequence continuations share this roller.
func rollSessionD20Tx(ctx context.Context, tx pgx.Tx, sessionID int64, settings SessionKarmicDiceSettings, key, label, mode string, previous *int) (SessionD20Result, error) {
	var result SessionD20Result
	var err error
	if mode != "advantage" && mode != "disadvantage" {
		mode = "normal"
	}
	result.Karmic = settings.Enabled
	if !settings.Separate {
		key, label = "shared", "Общая шкала"
	}
	if result.Karmic {
		err = tx.QueryRow(ctx, `SELECT balance FROM dndshare.session_karmic_scale WHERE session_id=$1 AND actor_key=$2`, sessionID, key).Scan(&result.BalanceBefore)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return result, err
		}
	}
	weights := karmicWeights(result.BalanceBefore)
	count := 1
	if mode != "normal" && previous == nil {
		count = 2
	}
	result.Rolls = make([]int, count)
	for i := range result.Rolls {
		unit, err := randomUnit()
		if err != nil {
			return result, err
		}
		result.Rolls[i] = karmicFace(weights, unit)
	}
	natural := result.Rolls[0]
	for _, face := range result.Rolls[1:] {
		natural = keptD20(natural, face, mode)
	}
	if previous != nil {
		natural = keptD20(natural, *previous, mode)
	}
	if result.Karmic {
		result.BalanceAfter = karmicNextBalance(result.BalanceBefore, natural, mode)
		_, err = tx.Exec(ctx, `INSERT INTO dndshare.session_karmic_scale(session_id,actor_key,actor_name,balance) VALUES($1,$2,$3,$4) ON CONFLICT(session_id,actor_key) DO UPDATE SET balance=EXCLUDED.balance,actor_name=EXCLUDED.actor_name`, sessionID, key, label, result.BalanceAfter)
		if err != nil {
			return result, err
		}
	}
	return result, nil
}
