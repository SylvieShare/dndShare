package store

import (
	"context"

	"github.com/jackc/pgx/v5"
)

func npcSceneIDs(links []SessionNPCSceneLink) []int64 {
	ids := make([]int64, 0, len(links))
	for _, link := range links {
		ids = append(ids, link.SceneID)
	}
	return uniqueWorldIDs(ids)
}

func validateNPCMutationLinksTx(
	ctx context.Context,
	tx pgx.Tx,
	sessionID, npcID int64,
	mutation SessionNPCMutation,
) error {
	if err := validateWorldSceneIDsTx(ctx, tx, sessionID, npcSceneIDs(mutation.SceneLinks)); err != nil {
		return err
	}
	return validateSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityNPC, npcID, mutation.Relations)
}

func replaceNPCLinksTx(ctx context.Context, tx pgx.Tx, sessionID, npcID int64, mutation SessionNPCMutation) error {
	if _, err := tx.Exec(ctx, `DELETE FROM dndshare.session_npc_scene WHERE npc_id = $1`, npcID); err != nil {
		return err
	}
	for _, link := range uniqueSceneLinks(mutation.SceneLinks) {
		if _, err := tx.Exec(ctx, `
			INSERT INTO dndshare.session_npc_scene (npc_id, scene_id, note) VALUES ($1, $2, $3)`,
			npcID, link.SceneID, link.Note,
		); err != nil {
			return err
		}
	}
	return replaceSessionEntityRelationsTx(ctx, tx, sessionID, SessionEntityNPC, npcID, mutation.Relations)
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
