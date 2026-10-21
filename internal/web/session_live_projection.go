package web

import (
	"context"
	"dndshare/internal/documentpatch"
	"dndshare/internal/store"
	"encoding/json"
	"sort"
)

// Every connection keeps only its authorized projection. Raw private sheet
// patches are never forwarded to another player.
type sessionRosterUpdate struct {
	FromSequence uint64                    `json:"fromSequence"`
	Sequence     uint64                    `json:"sequence"`
	Data         json.RawMessage           `json:"data,omitempty"`
	Patches      []documentpatch.Operation `json:"patches"`
}
type sessionLiveProjection struct {
	roster            json.RawMessage
	sequence          uint64
	journalCursor     int64
	journalSignatures map[int64]string
}

func (p *sessionLiveProjection) participants(ctx context.Context, s *Server, session store.GameSession, userID int64) (*sessionRosterUpdate, error) {
	participants, err := s.store.GetSessionParticipants(ctx, session.ID)
	if err != nil {
		return nil, err
	}
	for i, participant := range participants {
		participants[i] = store.SessionParticipantView(participant, session.Settings, userID, session.OwnerUserID == userID)
	}
	next, err := json.Marshal(nonNil(participants))
	if err != nil {
		return nil, err
	}
	update := &sessionRosterUpdate{FromSequence: p.sequence, Sequence: p.sequence + 1, Patches: []documentpatch.Operation{}}
	if p.roster == nil {
		update.Data = next
	} else {
		update.Patches, err = documentpatch.Diff(p.roster, next)
		if err != nil {
			return nil, err
		}
		if len(update.Patches) == 0 {
			return nil, nil
		}
	}
	p.roster = next
	p.sequence++
	return update, nil
}
func (p *sessionLiveProjection) chronicle(ctx context.Context, s *Server, sessionID, userID int64) (*sessionEventsResponse, error) {
	readAfter := p.journalCursor
	events := []store.SessionEvent{}
	for {
		page, err := s.store.GetSessionEvents(ctx, sessionID, userID, p.journalCursor, 100)
		if err != nil {
			return nil, err
		}
		events = append(events, page...)
		for _, event := range page {
			if event.ID > p.journalCursor {
				p.journalCursor = event.ID
			}
		}
		if len(page) < 100 {
			break
		}
	}
	mutable, err := s.store.SessionMutableEventUpdates(ctx, sessionID, userID, readAfter)
	if err != nil {
		return nil, err
	}
	recent, err := s.store.RecentSessionEvents(ctx, sessionID, userID)
	if err != nil {
		return nil, err
	}
	bootstrap := p.journalSignatures == nil
	if bootstrap {
		p.journalSignatures = map[int64]string{}
	}
	baseline := []store.SessionEvent{}
	if bootstrap {
		baseline = recent
	}
	newIDs := map[int64]bool{}
	for _, event := range events {
		newIDs[event.ID] = true
	}
	updates := []store.SessionEvent{}
	checked := map[int64]bool{}
	for _, event := range append(recent, mutable...) {
		if checked[event.ID] {
			continue
		}
		checked[event.ID] = true
		encoded, _ := json.Marshal(event)
		signature := string(encoded)
		previous, known := p.journalSignatures[event.ID]
		if !newIDs[event.ID] {
			if !known && !bootstrap {
				events = append(events, event)
				newIDs[event.ID] = true
			} else if known && previous != signature {
				updates = append(updates, event)
			}
		}
		p.journalSignatures[event.ID] = signature
	}
	for _, event := range events {
		encoded, _ := json.Marshal(event)
		p.journalSignatures[event.ID] = string(encoded)
		if event.ID > p.journalCursor {
			p.journalCursor = event.ID
		}
	}
	if bootstrap && readAfter == 0 {
		events = []store.SessionEvent{}
	}
	if len(p.journalSignatures) > 600 {
		ids := make([]int64, 0, len(p.journalSignatures))
		for id := range p.journalSignatures {
			ids = append(ids, id)
		}
		sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
		for _, id := range ids[:len(ids)-600] {
			delete(p.journalSignatures, id)
		}
	}
	return &sessionEventsResponse{Baseline: baseline, Events: events, Updates: updates}, nil
}
