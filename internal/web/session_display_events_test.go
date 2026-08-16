package web

import "testing"

func TestDisplayEventHubCoalescesRefreshSignals(t *testing.T) {
	hub := newDisplayEventHub()
	updates, unsubscribe := hub.subscribe(42)
	defer unsubscribe()

	hub.publish(42)
	hub.publish(42)
	if eventID := <-updates; eventID != 1 {
		t.Fatalf("first refresh id = %d, want 1", eventID)
	}
	select {
	case eventID := <-updates:
		t.Fatalf("duplicate refresh was not coalesced: %d", eventID)
	default:
	}

	hub.publish(42)
	if eventID := <-updates; eventID != 3 {
		t.Fatalf("latest refresh id = %d, want 3", eventID)
	}
}

func TestDisplayEventHubSeparatesSessions(t *testing.T) {
	hub := newDisplayEventHub()
	updates, unsubscribe := hub.subscribe(42)
	defer unsubscribe()

	hub.publish(7)
	select {
	case eventID := <-updates:
		t.Fatalf("received refresh from another session: %d", eventID)
	default:
	}
}

func TestDisplayEventHubCountsActiveScreens(t *testing.T) {
	hub := newDisplayEventHub()
	_, unsubscribeFirst := hub.subscribe(42)
	_, unsubscribeSecond := hub.subscribe(42)
	_, unsubscribeOther := hub.subscribe(7)
	defer unsubscribeOther()

	if count := hub.count(42); count != 2 {
		t.Fatalf("connected screens = %d, want 2", count)
	}
	unsubscribeFirst()
	if count := hub.count(42); count != 1 {
		t.Fatalf("connected screens after unsubscribe = %d, want 1", count)
	}
	unsubscribeSecond()
	if count := hub.count(42); count != 0 {
		t.Fatalf("connected screens after every unsubscribe = %d, want 0", count)
	}
}

func TestPublicMusicValuesAreBounded(t *testing.T) {
	if value := clampFloat(-4, 0, 1); value != 0 {
		t.Fatalf("negative volume was not clamped: %f", value)
	}
	if value := clampFloat(5, 0, 1); value != 1 {
		t.Fatalf("excessive volume was not clamped: %f", value)
	}
	invalid := int64(0)
	if positiveMusicTrackID(&invalid) != nil {
		t.Fatal("non-positive track id was exposed")
	}
}
