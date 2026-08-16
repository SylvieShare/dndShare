package store

import "context"

// enrichMusicTracks заполняет albumIds/tags и при необходимости ограничивает связи пользователем.
func (s *Store) enrichMusicTracks(ctx context.Context, tracks []MusicTrack, ownerUserIDs ...int64) ([]MusicTrack, error) {
	if len(tracks) == 0 {
		return tracks, nil
	}
	ids := make([]int64, len(tracks))
	for i, track := range tracks {
		ids[i] = track.ID
	}
	var albumIDs map[int64][]int64
	var tags map[int64][]MusicTag
	var err error
	if len(ownerUserIDs) > 0 {
		albumIDs, err = s.albumIDsByTracksForUser(ctx, ids, ownerUserIDs[0])
	} else {
		albumIDs, err = s.albumIDsByTracks(ctx, ids)
	}
	if err != nil {
		return nil, err
	}
	if len(ownerUserIDs) > 0 {
		tags, err = s.tagsByTracksForUser(ctx, ids, ownerUserIDs[0])
	} else {
		tags, err = s.tagsByTracks(ctx, ids)
	}
	if err != nil {
		return nil, err
	}
	for i := range tracks {
		tracks[i].AlbumIds = albumIDs[tracks[i].ID]
		if tracks[i].AlbumIds == nil {
			tracks[i].AlbumIds = []int64{}
		}
		tracks[i].Tags = tags[tracks[i].ID]
		if tracks[i].Tags == nil {
			tracks[i].Tags = []MusicTag{}
		}
	}
	return tracks, nil
}

func (s *Store) albumIDsByTracksForUser(ctx context.Context, trackIDs []int64, ownerUserID int64) (map[int64][]int64, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT at.track_id, at.album_id
		 FROM dndshare.music_album_track at
		 JOIN dndshare.music_album a ON a.id = at.album_id
		 WHERE at.track_id = ANY($1) AND (a.owner_user_id = $2 OR a.is_system = true)`,
		trackIDs, ownerUserID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[int64][]int64{}
	for rows.Next() {
		var trackID, albumID int64
		if err := rows.Scan(&trackID, &albumID); err != nil {
			return nil, err
		}
		result[trackID] = append(result[trackID], albumID)
	}
	return result, rows.Err()
}

func (s *Store) albumIDsByTracks(ctx context.Context, trackIDs []int64) (map[int64][]int64, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT track_id, album_id FROM dndshare.music_album_track WHERE track_id = ANY($1)`, trackIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[int64][]int64{}
	for rows.Next() {
		var trackID, albumID int64
		if err := rows.Scan(&trackID, &albumID); err != nil {
			return nil, err
		}
		result[trackID] = append(result[trackID], albumID)
	}
	return result, rows.Err()
}

func (s *Store) tagsByTracks(ctx context.Context, trackIDs []int64) (map[int64][]MusicTag, error) {
	return s.queryTagsByTracks(ctx, trackIDs, 0)
}

func (s *Store) tagsByTracksForUser(ctx context.Context, trackIDs []int64, ownerUserID int64) (map[int64][]MusicTag, error) {
	return s.queryTagsByTracks(ctx, trackIDs, ownerUserID)
}

func (s *Store) queryTagsByTracks(ctx context.Context, trackIDs []int64, ownerUserID int64) (map[int64][]MusicTag, error) {
	query := `SELECT tt.track_id, t.id, t.owner_user_id, t.name
		 FROM dndshare.music_track_tag tt
		 JOIN dndshare.music_tag t ON t.id = tt.tag_id
		 WHERE tt.track_id = ANY($1)`
	args := []any{trackIDs}
	if ownerUserID != 0 {
		query += ` AND t.owner_user_id = $2`
		args = append(args, ownerUserID)
	}
	query += ` ORDER BY lower(t.name)`
	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := map[int64][]MusicTag{}
	for rows.Next() {
		var trackID int64
		var tag MusicTag
		if err := rows.Scan(&trackID, &tag.ID, &tag.OwnerUserID, &tag.Name); err != nil {
			return nil, err
		}
		result[trackID] = append(result[trackID], tag)
	}
	return result, rows.Err()
}
