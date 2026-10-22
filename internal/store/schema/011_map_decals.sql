CREATE TABLE dndshare.map_decal_image (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id bigint NOT NULL REFERENCES dndshare.users(id) ON DELETE CASCADE,
    image_id bigint NOT NULL REFERENCES dndshare.storage_image(id),
    pixel_width integer NOT NULL CHECK (pixel_width BETWEEN 1 AND 2048),
    pixel_height integer NOT NULL CHECK (pixel_height BETWEEN 1 AND 2048),
    name varchar(100) NOT NULL,
    category varchar(16) NOT NULL CHECK (category IN ('traces', 'graffiti', 'posters', 'custom')),
    created_at timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX map_decal_image_user_idx ON dndshare.map_decal_image(user_id, created_at DESC);
