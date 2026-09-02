package web

import "testing"

func TestSessionLiveHubCoalescesTypedUpdates(t *testing.T) {
	hub := newSessionLiveHub()
	subscription, unsubscribe := hub.subscribe(42)
	defer unsubscribe()

	hub.publish(42, sessionLiveUpdate{Session: true, Participants: true, CharacterIDs: []int64{9, 4}})
	count := 2
	hub.publish(42, sessionLiveUpdate{CharacterIDs: []int64{9}, Journal: true, ConnectedScreens: &count})
	<-subscription.wake
	eventID, update := hub.drain(subscription)
	if eventID != 2 {
		t.Fatalf("event id = %d, want 2", eventID)
	}
	if !update.Session || !update.Participants || !update.Journal {
		t.Fatalf("boolean invalidations were not merged: %#v", update)
	}
	if len(update.CharacterIDs) != 2 || update.CharacterIDs[0] != 4 || update.CharacterIDs[1] != 9 {
		t.Fatalf("character invalidations = %#v, want [4 9]", update.CharacterIDs)
	}
	if update.ConnectedScreens == nil || *update.ConnectedScreens != 2 {
		t.Fatalf("connected screens = %#v, want 2", update.ConnectedScreens)
	}
	select {
	case <-subscription.wake:
		t.Fatal("coalesced updates produced a second wake-up")
	default:
	}
}

func TestSessionLiveHubSeparatesSessions(t *testing.T) {
	hub := newSessionLiveHub()
	subscription, unsubscribe := hub.subscribe(42)
	defer unsubscribe()

	hub.publish(7, sessionLiveUpdate{Journal: true})
	select {
	case <-subscription.wake:
		t.Fatal("received an update for another session")
	default:
	}
}

func TestSessionLiveHubKeepsLatestPresenceCount(t *testing.T) {
	hub := newSessionLiveHub()
	subscription, unsubscribe := hub.subscribe(42)
	defer unsubscribe()

	first, latest := 1, 3
	hub.publish(42, sessionLiveUpdate{ConnectedScreens: &first})
	hub.publish(42, sessionLiveUpdate{ConnectedScreens: &latest})
	<-subscription.wake
	_, update := hub.drain(subscription)
	if update.ConnectedScreens == nil || *update.ConnectedScreens != latest {
		t.Fatalf("connected screens = %#v, want %d", update.ConnectedScreens, latest)
	}
}
