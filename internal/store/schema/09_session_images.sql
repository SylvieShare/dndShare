-- ---------------------------------------------------------------------------
-- Unified session imagery. Every chapter, scenario, location and NPC points
-- to storage_image, regardless of whether the image is a system catalogue
-- asset or a user upload. System files live under stable S3 object keys.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_image_session_system_key
    ON dndshare.storage_image USING btree ("key")
    WHERE "type" = 'session-image';

WITH system_images(catalog_key, object_key) AS (
    VALUES
      ('city', 'system-session-images/v1/story/city.jpg'),
      ('village', 'system-session-images/v1/story/village.jpg'),
      ('castle', 'system-session-images/v1/story/castle.jpg'),
      ('tavern', 'system-session-images/v1/story/tavern.jpg'),
      ('forest', 'system-session-images/v1/story/forest.jpg'),
      ('cave', 'system-session-images/v1/story/cave.jpg'),
      ('mountains', 'system-session-images/v1/story/mountains.jpg'),
      ('coast', 'system-session-images/v1/story/coast.jpg'),
      ('camp', 'system-session-images/v1/story/camp.jpg'),
      ('road', 'system-session-images/v1/story/road.jpg'),
      ('ruins', 'system-session-images/v1/story/ruins.jpg'),
      ('dungeon', 'system-session-images/v1/story/dungeon.jpg'),
      ('battle', 'system-session-images/v1/story/battle.jpg'),
      ('investigation', 'system-session-images/v1/story/investigation.jpg'),
      ('negotiation', 'system-session-images/v1/story/negotiation.jpg'),
      ('chase', 'system-session-images/v1/story/chase.jpg'),
      ('puzzle', 'system-session-images/v1/story/puzzle.jpg'),
      ('discovery', 'system-session-images/v1/story/discovery.jpg'),
      ('npc-scholar', 'system-session-images/v1/npc/npc-scholar.jpg'),
      ('npc-artisan', 'system-session-images/v1/npc/npc-artisan.jpg'),
      ('npc-ranger', 'system-session-images/v1/npc/npc-ranger.jpg'),
      ('npc-mercenary', 'system-session-images/v1/npc/npc-mercenary.jpg'),
      ('npc-mystic', 'system-session-images/v1/npc/npc-mystic.jpg'),
      ('npc-noble', 'system-session-images/v1/npc/npc-noble.jpg')
)
INSERT INTO dndshare.storage_image (user_id, "key", url, "type", deleted)
SELECT NULL, image.object_key,
       'https://storage.yandexcloud.net/dndshare/' || image.object_key,
       'session-image', false
FROM system_images image
ON CONFLICT ("key") WHERE "type" = 'session-image'
DO UPDATE SET deleted = false;

CREATE TABLE IF NOT EXISTS dndshare.session_image_catalog (
    image_id       int8 NOT NULL REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT,
    catalog_key    varchar(64) NOT NULL,
    scope          varchar(16) NOT NULL,
    category_key   varchar(32) NOT NULL,
    category_label varchar(80) NOT NULL,
    label          varchar(80) NOT NULL,
    sort_order     int4 NOT NULL,
    CONSTRAINT session_image_catalog_pk PRIMARY KEY (image_id),
    CONSTRAINT session_image_catalog_key_unique UNIQUE (catalog_key),
    CONSTRAINT session_image_catalog_scope_check CHECK (scope IN ('story', 'npc'))
);

WITH catalog(catalog_key, object_key, scope, category_key, category_label, label, sort_order) AS (
    VALUES
      ('city', 'system-session-images/v1/story/city.jpg', 'story', 'settlements', 'Поселения', 'Город', 10),
      ('village', 'system-session-images/v1/story/village.jpg', 'story', 'settlements', 'Поселения', 'Деревня', 20),
      ('castle', 'system-session-images/v1/story/castle.jpg', 'story', 'settlements', 'Поселения', 'Замок', 30),
      ('tavern', 'system-session-images/v1/story/tavern.jpg', 'story', 'settlements', 'Поселения', 'Таверна', 40),
      ('forest', 'system-session-images/v1/story/forest.jpg', 'story', 'wilderness', 'Природа', 'Лес', 110),
      ('cave', 'system-session-images/v1/story/cave.jpg', 'story', 'wilderness', 'Природа', 'Пещера', 120),
      ('mountains', 'system-session-images/v1/story/mountains.jpg', 'story', 'wilderness', 'Природа', 'Горы', 130),
      ('coast', 'system-session-images/v1/story/coast.jpg', 'story', 'wilderness', 'Природа', 'Побережье', 140),
      ('camp', 'system-session-images/v1/story/camp.jpg', 'story', 'adventure', 'Приключение', 'Лагерь', 210),
      ('road', 'system-session-images/v1/story/road.jpg', 'story', 'adventure', 'Приключение', 'Дорога', 220),
      ('ruins', 'system-session-images/v1/story/ruins.jpg', 'story', 'adventure', 'Приключение', 'Руины', 230),
      ('dungeon', 'system-session-images/v1/story/dungeon.jpg', 'story', 'adventure', 'Приключение', 'Подземелье', 240),
      ('battle', 'system-session-images/v1/story/battle.jpg', 'story', 'story', 'Сюжет', 'Бой', 310),
      ('investigation', 'system-session-images/v1/story/investigation.jpg', 'story', 'story', 'Сюжет', 'Расследование', 320),
      ('negotiation', 'system-session-images/v1/story/negotiation.jpg', 'story', 'story', 'Сюжет', 'Переговоры', 330),
      ('chase', 'system-session-images/v1/story/chase.jpg', 'story', 'story', 'Сюжет', 'Погоня', 340),
      ('puzzle', 'system-session-images/v1/story/puzzle.jpg', 'story', 'story', 'Сюжет', 'Загадка', 350),
      ('discovery', 'system-session-images/v1/story/discovery.jpg', 'story', 'story', 'Сюжет', 'Открытие', 360),
      ('npc-scholar', 'system-session-images/v1/npc/npc-scholar.jpg', 'npc', 'civil', 'Горожане', 'Учёный', 10),
      ('npc-artisan', 'system-session-images/v1/npc/npc-artisan.jpg', 'npc', 'civil', 'Горожане', 'Ремесленник', 20),
      ('npc-ranger', 'system-session-images/v1/npc/npc-ranger.jpg', 'npc', 'adventurers', 'Искатели приключений', 'Следопыт', 110),
      ('npc-mercenary', 'system-session-images/v1/npc/npc-mercenary.jpg', 'npc', 'adventurers', 'Искатели приключений', 'Наёмник', 120),
      ('npc-mystic', 'system-session-images/v1/npc/npc-mystic.jpg', 'npc', 'intrigue', 'Мистика и интриги', 'Мистик', 210),
      ('npc-noble', 'system-session-images/v1/npc/npc-noble.jpg', 'npc', 'intrigue', 'Мистика и интриги', 'Знать', 220)
)
INSERT INTO dndshare.session_image_catalog (
    image_id, catalog_key, scope, category_key, category_label, label, sort_order
)
SELECT image.id, catalog.catalog_key, catalog.scope, catalog.category_key,
       catalog.category_label, catalog.label, catalog.sort_order
FROM catalog
JOIN dndshare.storage_image image ON image."key" = catalog.object_key AND image."type" = 'session-image'
ON CONFLICT (catalog_key) DO UPDATE SET
    image_id = EXCLUDED.image_id,
    scope = EXCLUDED.scope,
    category_key = EXCLUDED.category_key,
    category_label = EXCLUDED.category_label,
    label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order;

ALTER TABLE dndshare.session_chapter ADD COLUMN IF NOT EXISTS image_id int8 NULL;
UPDATE dndshare.session_chapter entity
SET image_id = COALESCE(
    entity.image_id,
    entity.custom_image_id,
    (SELECT image_id FROM dndshare.session_image_catalog WHERE catalog_key = entity.image_preset_key),
    (SELECT image_id FROM dndshare.session_image_catalog WHERE catalog_key = 'city')
);
ALTER TABLE dndshare.session_chapter DROP CONSTRAINT IF EXISTS session_chapter_image_source_check;
ALTER TABLE dndshare.session_chapter DROP COLUMN IF EXISTS image_preset_key;
ALTER TABLE dndshare.session_chapter DROP COLUMN IF EXISTS custom_image_id;
ALTER TABLE dndshare.session_chapter ALTER COLUMN image_id SET NOT NULL;

ALTER TABLE dndshare.session_scene ADD COLUMN IF NOT EXISTS image_id int8 NULL;
UPDATE dndshare.session_scene entity
SET image_id = COALESCE(
    entity.image_id,
    (SELECT image_id FROM dndshare.session_image_catalog WHERE catalog_key = entity.image_preset_key),
    (SELECT image_id FROM dndshare.session_image_catalog WHERE catalog_key = 'discovery')
);
ALTER TABLE dndshare.session_scene DROP COLUMN IF EXISTS image_preset_key;
ALTER TABLE dndshare.session_scene ALTER COLUMN image_id SET NOT NULL;

ALTER TABLE dndshare.session_location ADD COLUMN IF NOT EXISTS image_id int8 NULL;
UPDATE dndshare.session_location entity
SET image_id = COALESCE(
    entity.image_id,
    (SELECT image_id FROM dndshare.session_image_catalog WHERE catalog_key = entity.image_preset_key),
    (SELECT image_id FROM dndshare.session_image_catalog WHERE catalog_key = 'city')
);
ALTER TABLE dndshare.session_location DROP COLUMN IF EXISTS image_preset_key;
ALTER TABLE dndshare.session_location ALTER COLUMN image_id SET NOT NULL;

ALTER TABLE dndshare.session_npc ADD COLUMN IF NOT EXISTS image_id int8 NULL;
UPDATE dndshare.session_npc entity
SET image_id = COALESCE(
    entity.image_id,
    entity.custom_image_id,
    (SELECT image_id FROM dndshare.session_image_catalog WHERE catalog_key = entity.image_preset_key),
    (SELECT image_id FROM dndshare.session_image_catalog WHERE catalog_key = 'npc-scholar')
);
ALTER TABLE dndshare.session_npc DROP CONSTRAINT IF EXISTS session_npc_image_source_check;
ALTER TABLE dndshare.session_npc DROP COLUMN IF EXISTS image_preset_key;
ALTER TABLE dndshare.session_npc DROP COLUMN IF EXISTS custom_image_id;
ALTER TABLE dndshare.session_npc ALTER COLUMN image_id SET NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_chapter_image_fk') THEN
        ALTER TABLE dndshare.session_chapter ADD CONSTRAINT session_chapter_image_fk
            FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_scene_image_fk') THEN
        ALTER TABLE dndshare.session_scene ADD CONSTRAINT session_scene_image_fk
            FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_location_image_fk') THEN
        ALTER TABLE dndshare.session_location ADD CONSTRAINT session_location_image_fk
            FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_npc_image_fk') THEN
        ALTER TABLE dndshare.session_npc ADD CONSTRAINT session_npc_image_fk
            FOREIGN KEY (image_id) REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_chapter_image_id ON dndshare.session_chapter USING btree (image_id);
CREATE INDEX IF NOT EXISTS idx_session_scene_image_id ON dndshare.session_scene USING btree (image_id);
CREATE INDEX IF NOT EXISTS idx_session_location_image_id ON dndshare.session_location USING btree (image_id);
CREATE INDEX IF NOT EXISTS idx_session_npc_image_id ON dndshare.session_npc USING btree (image_id);
