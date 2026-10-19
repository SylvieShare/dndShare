ALTER TABLE dndshare.map_model
    ADD COLUMN name_en character varying(160) DEFAULT '' NOT NULL,
    ADD COLUMN category character varying(32) DEFAULT '' NOT NULL,
    ADD CONSTRAINT map_model_category_valid CHECK (category IN (
        '', 'floor', 'wall', 'water', 'railway', 'stairs', 'frame', 'bridge', 'passage', 'column', 'object'
    ));

CREATE TABLE dndshare.map_model_group (
    collection character varying(80) NOT NULL,
    code character varying(160) NOT NULL,
    name character varying(160) NOT NULL,
    name_en character varying(160) NOT NULL,
    PRIMARY KEY (collection, code),
    CONSTRAINT map_model_group_code_valid CHECK (code ~ '^[A-Z]{2,3}-[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT map_model_group_names_valid CHECK (btrim(name) <> '' AND btrim(name_en) <> '')
);
