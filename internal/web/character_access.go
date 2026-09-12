package web

import (
	"context"

	"dndshare/internal/store"
)

type characterSessionOwnerLookup interface {
	IsCharInSessionOwnedBy(context.Context, string, int64) (bool, error)
}

func canReadCharacter(ctx context.Context, sessions characterSessionOwnerLookup, char store.CharacterItem, userID int64, authed bool) (bool, error) {
	if char.PublicVisible {
		return true, nil
	}
	if !authed {
		return false, nil
	}
	if char.UserID == userID {
		return true, nil
	}
	return sessions.IsCharInSessionOwnedBy(ctx, char.UUID, userID)
}
