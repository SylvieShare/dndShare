package store

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func npcLocationIDs(links []SessionNPCLocationLink) []int64 {
	ids := make([]int64, 0, len(links))
	for _, link := range links {
		ids = append(ids, link.LocationID)
	}
	return uniqueWorldIDs(ids)
}

func npcSceneIDs(links []SessionNPCSceneLink) []int64 {
	ids := make([]int64, 0, len(links))
	for _, link := range links {
		ids = append(ids, link.SceneID)
	}
	return uniqueWorldIDs(ids)
}

func npcRelationIDs(links []SessionNPCNPCLink) []int64 {
	ids := make([]int64, 0, len(links))
	for _, link := range links {
		ids = append(ids, link.NPCID)
	}
	return uniqueWorldIDs(ids)
}

func validateNPCMutationLinksTx(
	ctx context.Context,
	tx pgx.Tx,
	sessionID, npcID int64,
	mutation SessionNPCMutation,
) error {
	if err := validateWorldLocationIDsTx(ctx, tx, sessionID, npcLocationIDs(mutation.LocationLinks)); err != nil {
		return err
	}
	if err := validateWorldSceneIDsTx(ctx, tx, sessionID, npcSceneIDs(mutation.SceneLinks)); err != nil {
		return err
	}
	npcIDs := npcRelationIDs(mutation.NPCLinks)
	for _, targetID := range npcIDs {
		if targetID == npcID {
			return ErrInvalidWorldReference
		}
	}
	if len(npcIDs) == 0 {
		return nil
	}
	var count int
	if err := tx.QueryRow(ctx, `
		SELECT count(*) FROM dndshare.session_npc
		WHERE session_id = $1 AND id = ANY($2::bigint[])`, sessionID, npcIDs,
	).Scan(&count); err != nil {
		return err
	}
	if count != len(npcIDs) {
		return ErrInvalidWorldReference
	}
	return nil
}

func replaceNPCLinksTx(ctx context.Context, tx pgx.Tx, npcID int64, mutation SessionNPCMutation) error {
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.session_npc_location WHERE npc_id = $1`, npcID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.session_npc_scene WHERE npc_id = $1`, npcID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM dndshare.session_npc_relation WHERE left_npc_id = $1 OR right_npc_id = $1`, npcID,
	); err != nil {
		return err
	}
	for _, link := range uniqueLocationLinks(mutation.LocationLinks) {
		if _, err := tx.Exec(ctx, `
			INSERT INTO dndshare.session_npc_location (npc_id, location_id, note) VALUES ($1, $2, $3)`,
			npcID, link.LocationID, link.Note,
		); err != nil {
			return err
		}
	}
	for _, link := range uniqueSceneLinks(mutation.SceneLinks) {
		if _, err := tx.Exec(ctx, `
			INSERT INTO dndshare.session_npc_scene (npc_id, scene_id, note) VALUES ($1, $2, $3)`,
			npcID, link.SceneID, link.Note,
		); err != nil {
			return err
		}
	}
	for _, link := range uniqueNPCLinks(mutation.NPCLinks) {
		leftID, rightID := npcID, link.NPCID
		if leftID > rightID {
			leftID, rightID = rightID, leftID
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO dndshare.session_npc_relation (left_npc_id, right_npc_id, note) VALUES ($1, $2, $3)`,
			leftID, rightID, link.Note,
		); err != nil {
			return err
		}
	}
	return nil
}

func uniqueLocationLinks(links []SessionNPCLocationLink) []SessionNPCLocationLink {
	result := make([]SessionNPCLocationLink, 0, len(links))
	seen := map[int64]bool{}
	for _, link := range links {
		if link.LocationID > 0 && !seen[link.LocationID] {
			seen[link.LocationID] = true
			result = append(result, link)
		}
	}
	return result
}

func uniqueSceneLinks(links []SessionNPCSceneLink) []SessionNPCSceneLink {
	result := make([]SessionNPCSceneLink, 0, len(links))
	seen := map[int64]bool{}
	for _, link := range links {
		if link.SceneID > 0 && !seen[link.SceneID] {
			seen[link.SceneID] = true
			result = append(result, link)
		}
	}
	return result
}

func uniqueNPCLinks(links []SessionNPCNPCLink) []SessionNPCNPCLink {
	result := make([]SessionNPCNPCLink, 0, len(links))
	seen := map[int64]bool{}
	for _, link := range links {
		if link.NPCID > 0 && !seen[link.NPCID] {
			seen[link.NPCID] = true
			result = append(result, link)
		}
	}
	return result
}
