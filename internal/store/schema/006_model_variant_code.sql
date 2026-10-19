ALTER TABLE dndshare.map_model_definition
    ADD COLUMN variant_code character varying(160) DEFAULT '' NOT NULL;
ALTER TABLE dndshare.map_model_definition
    ADD CONSTRAINT map_model_variant_code_valid CHECK (
        variant_code = '' OR (
            variant_code ~ '^[A-Z]{2,3}-[a-z0-9]+(-[a-z0-9]+)*$'
            AND length(variant_code) <= 160
            AND split_part(variant_code, '-', 1) = split_part(code, '-', 1)
        )
    );
