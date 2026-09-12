package web

import (
	"context"
	"errors"
	"testing"

	"dndshare/internal/store"
)

type characterSessionOwnerStub struct {
	allowed  bool
	err      error
	calls    int
	charUUID string
	userID   int64
}

func (s *characterSessionOwnerStub) IsCharInSessionOwnedBy(_ context.Context, charUUID string, userID int64) (bool, error) {
	s.calls++
	s.charUUID, s.userID = charUUID, userID
	return s.allowed, s.err
}

func TestCanReadCharacter(t *testing.T) {
	dbError := errors.New("database unavailable")
	for _, tt := range []struct {
		name           string
		public, authed bool
		userID         int64
		isDM           bool
		lookupErr      error
		want           bool
		wantCalls      int
	}{
		{name: "anonymous public", public: true, want: true},
		{name: "unrelated public", public: true, authed: true, userID: 20, want: true},
		{name: "anonymous private"},
		{name: "private owner", authed: true, userID: 10, want: true},
		{name: "private session master", authed: true, userID: 20, isDM: true, want: true, wantCalls: 1},
		{name: "private other player or unrelated master", authed: true, userID: 30, wantCalls: 1},
		{name: "membership lookup failure", authed: true, userID: 20, lookupErr: dbError, wantCalls: 1},
	} {
		t.Run(tt.name, func(t *testing.T) {
			sessions := &characterSessionOwnerStub{allowed: tt.isDM, err: tt.lookupErr}
			char := store.CharacterItem{UUID: "99f034e1-7659-42a5-a24e-79e1c1f3a7f4", UserID: 10, PublicVisible: tt.public}
			got, err := canReadCharacter(context.Background(), sessions, char, tt.userID, tt.authed)
			if got != tt.want || !errors.Is(err, tt.lookupErr) {
				t.Fatalf("canReadCharacter = (%v, %v), want (%v, %v)", got, err, tt.want, tt.lookupErr)
			}
			if sessions.calls != tt.wantCalls {
				t.Fatalf("membership lookups = %d, want %d", sessions.calls, tt.wantCalls)
			}
			if sessions.calls > 0 && (sessions.charUUID != char.UUID || sessions.userID != tt.userID) {
				t.Fatal("membership lookup must use the requested character and authenticated user")
			}
		})
	}
}
