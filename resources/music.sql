-- Музыкальная библиотека и плеер сессии

CREATE TABLE dndshare.music_track (
    id            BIGSERIAL PRIMARY KEY,
    uuid          UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    owner_user_id BIGINT NOT NULL,
    name          VARCHAR(255) NOT NULL,
    file_key      VARCHAR(512) NOT NULL,
    file_name     VARCHAR(255) NOT NULL,
    duration_sec  INT,
    file_size     BIGINT NOT NULL,
    mime_type     VARCHAR(64) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX music_track_owner_idx ON dndshare.music_track (owner_user_id);

CREATE TABLE dndshare.music_album (
    id            BIGSERIAL PRIMARY KEY,
    owner_user_id BIGINT NOT NULL,
    name          VARCHAR(255) NOT NULL,
    color         VARCHAR(16),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX music_album_owner_idx ON dndshare.music_album (owner_user_id);

CREATE TABLE dndshare.music_album_track (
    id        BIGSERIAL PRIMARY KEY,
    album_id  BIGINT NOT NULL REFERENCES dndshare.music_album(id) ON DELETE CASCADE,
    track_id  BIGINT NOT NULL REFERENCES dndshare.music_track(id) ON DELETE CASCADE,
    position  INT NOT NULL DEFAULT 0,
    UNIQUE (album_id, track_id)
);

CREATE INDEX music_album_track_album_idx ON dndshare.music_album_track (album_id, position);
CREATE INDEX music_album_track_track_idx ON dndshare.music_album_track (track_id);

CREATE TABLE dndshare.music_tag (
    id            BIGSERIAL PRIMARY KEY,
    owner_user_id BIGINT NOT NULL,
    name          VARCHAR(64) NOT NULL,
    UNIQUE (owner_user_id, name)
);

CREATE TABLE dndshare.music_track_tag (
    track_id BIGINT NOT NULL REFERENCES dndshare.music_track(id) ON DELETE CASCADE,
    tag_id   BIGINT NOT NULL REFERENCES dndshare.music_tag(id) ON DELETE CASCADE,
    PRIMARY KEY (track_id, tag_id)
);

CREATE INDEX music_track_tag_tag_idx ON dndshare.music_track_tag (tag_id);

CREATE TABLE dndshare.session_music_state (
    id         BIGSERIAL PRIMARY KEY,
    session_id BIGINT UNIQUE NOT NULL REFERENCES dndshare.session(id),
    data       JSONB NOT NULL DEFAULT '{}',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
