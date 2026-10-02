package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Wallets are also read by JavaScript; every balance must remain an exact integer.
const MaxMoneyAmount int64 = 9007199254740991

var ErrMoneyTransfer = errors.New("Некорректная передача денег")
var ErrMoneyTransferConflict = errors.New("Запрос передачи денег уже использован для другого действия")

type MoneyTransferData struct {
	SenderCharUUID    string `json:"senderCharUuid"`
	RecipientCharUUID string `json:"recipientCharUuid"`
	SenderName        string `json:"senderName"`
	RecipientName     string `json:"recipientName"`
	CurrencyID        int64  `json:"currencyId"`
	CurrencyName      string `json:"currencyName"`
	Amount            int64  `json:"amount"`
}

func walletAmounts(doc transferDocument) (map[string]any, error) {
	values := doc.values()
	wallet, ok := values["money"].(map[string]any)
	if values["money"] != nil && !ok {
		return nil, fmt.Errorf("%w: кошелёк повреждён", ErrMoneyTransfer)
	}
	if wallet == nil {
		wallet = map[string]any{}
		values["money"] = wallet
	}
	amounts, ok := wallet["amounts"].(map[string]any)
	if wallet["amounts"] != nil && !ok {
		return nil, fmt.Errorf("%w: кошелёк повреждён", ErrMoneyTransfer)
	}
	if amounts == nil {
		amounts = map[string]any{}
		wallet["amounts"] = amounts
	}
	return amounts, nil
}

func walletBalance(amounts map[string]any, key string) (int64, error) {
	if amounts[key] == nil {
		return 0, nil
	}
	value, ok := amounts[key].(float64)
	if !ok || math.IsNaN(value) || math.IsInf(value, 0) || value < 0 || value > float64(MaxMoneyAmount) || math.Trunc(value) != value {
		return 0, fmt.Errorf("%w: некорректный баланс", ErrMoneyTransfer)
	}
	return int64(value), nil
}

func moveWalletMoney(sender, recipient transferDocument, currencyID, amount int64) error {
	if currencyID <= 0 || amount <= 0 || amount > MaxMoneyAmount {
		return ErrMoneyTransfer
	}
	from, err := walletAmounts(sender)
	if err != nil {
		return err
	}
	to, err := walletAmounts(recipient)
	if err != nil {
		return err
	}
	key := strconv.FormatInt(currencyID, 10)
	fromBalance, err := walletBalance(from, key)
	if err != nil {
		return err
	}
	toBalance, err := walletBalance(to, key)
	if err != nil {
		return err
	}
	if fromBalance < amount {
		return fmt.Errorf("%w: недостаточно денег", ErrMoneyTransfer)
	}
	if toBalance > MaxMoneyAmount-amount {
		return fmt.Errorf("%w: превышен предел кошелька получателя", ErrMoneyTransfer)
	}
	from[key], to[key] = float64(fromBalance-amount), float64(toBalance+amount)
	return nil
}

// TransferCharacterMoney updates both versioned sheets and their journal in one transaction.
func (s *Store) TransferCharacterMoney(ctx context.Context, userID, sessionID, senderID, recipientID, version, currencyID, amount int64, actionID string) (SessionEvent, error) {
	if currencyID <= 0 || amount <= 0 || amount > MaxMoneyAmount {
		return SessionEvent{}, ErrMoneyTransfer
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return SessionEvent{}, err
	}
	defer tx.Rollback(ctx)
	chars, err := lockInteractionPair(ctx, tx, userID, sessionID, senderID, recipientID)
	if err != nil {
		return SessionEvent{}, err
	}
	data := MoneyTransferData{SenderName: characterName(chars[senderID].Data), RecipientName: characterName(chars[recipientID].Data), CurrencyID: currencyID, Amount: amount}
	if err = tx.QueryRow(ctx, `SELECT sender.uuid::text, recipient.uuid::text FROM dndshare."char" sender, dndshare."char" recipient WHERE sender.id=$1 AND recipient.id=$2`, senderID, recipientID).Scan(&data.SenderCharUUID, &data.RecipientCharUUID); err != nil {
		return SessionEvent{}, err
	}
	// Check a retry before the revision and balance: the first request may have committed.
	existing, err := scanSessionEvent(tx.QueryRow(ctx, sessionEventSelect+` AND e.session_id=$1 AND e.client_action_id=$2::uuid`, sessionID, actionID))
	if err == nil {
		var previous MoneyTransferData
		if json.Unmarshal(existing.Data, &previous) != nil || existing.EventType != "money_transfer" || existing.AuthorUserID != userID ||
			existing.ActorCharID == nil || *existing.ActorCharID != senderID || previous.RecipientCharUUID != data.RecipientCharUUID || previous.CurrencyID != currencyID || previous.Amount != amount {
			return SessionEvent{}, ErrMoneyTransferConflict
		}
		return existing, tx.Commit(ctx)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return SessionEvent{}, err
	}
	if chars[senderID].Version != version {
		return SessionEvent{}, ErrCharacterVersion
	}
	err = tx.QueryRow(ctx, `SELECT value FROM dndshare.suggest WHERE type_id=17 AND id=$1 AND (user_id IS NULL OR (user_id=$2 AND user_id=$3))`, currencyID, userID, chars[recipientID].UserID).Scan(&data.CurrencyName)
	if errors.Is(err, pgx.ErrNoRows) {
		return SessionEvent{}, fmt.Errorf("%w: валюта недоступна участникам", ErrMoneyTransfer)
	}
	if err != nil {
		return SessionEvent{}, err
	}
	sender, err := decodeTransferDocument(chars[senderID].Data)
	if err != nil {
		return SessionEvent{}, err
	}
	recipient, err := decodeTransferDocument(chars[recipientID].Data)
	if err != nil {
		return SessionEvent{}, err
	}
	if err = moveWalletMoney(sender, recipient, currencyID, amount); err != nil {
		return SessionEvent{}, err
	}
	for _, change := range []struct {
		id  int64
		doc transferDocument
	}{{senderID, sender}, {recipientID, recipient}} {
		if err = saveTransferDocument(ctx, tx, change.id, change.doc); err != nil {
			return SessionEvent{}, err
		}
	}
	encoded, _ := json.Marshal(data)
	var eventID int64
	err = tx.QueryRow(ctx, `INSERT INTO dndshare.session_event
 (session_id,author_user_id,actor_char_id,actor_name,event_type,action,data,visibility,client_action_id)
 VALUES($1,$2,$3,$4,'money_transfer','Передача денег',CAST($5 AS jsonb),'public',$6::uuid) RETURNING id`, sessionID, userID, senderID, data.SenderName, json.RawMessage(encoded), actionID).Scan(&eventID)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			err = ErrMoneyTransferConflict
		}
		return SessionEvent{}, err
	}
	return interactionEventCommit(ctx, tx, eventID)
}
