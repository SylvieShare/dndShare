-- dndshare.char_template определение

-- Drop table

-- DROP TABLE dndshare.char_template;

CREATE TABLE dndshare.char_template (
                                        id int8 GENERATED ALWAYS AS IDENTITY( INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START 1 CACHE 1 NO CYCLE) NOT NULL,
                                        "name" varchar NOT NULL,
                                        "schema" jsonb NOT NULL,
                                        CONSTRAINT char_template_pk PRIMARY KEY (id)
);


-- dndshare.suggest определение

-- Drop table

-- DROP TABLE dndshare.suggest;

CREATE TABLE dndshare.suggest (
                                  id bigserial NOT NULL,
                                  user_id int8 NULL,
                                  type_id int8 NOT NULL,
                                  value varchar NOT NULL,
                                  CONSTRAINT suggest_pk PRIMARY KEY (id)
);


-- dndshare.dictionary_text определение

-- Drop table

-- DROP TABLE dndshare.dictionary_text;

CREATE TABLE dndshare.dictionary_text (
                                          id bigserial NOT NULL,
                                          lang text NOT NULL,
                                          keyset text NOT NULL,
                                          "key" text NOT NULL,
                                          value text NOT NULL
);


-- dndshare.sources определение

-- Drop table

-- DROP TABLE dndshare.sources;

CREATE TABLE dndshare.sources (
                                  id bigserial NOT NULL,
                                  id_t text NULL,
                                  CONSTRAINT sources_pk PRIMARY KEY (id)
);


-- dndshare.sources_text определение

-- Drop table

-- DROP TABLE dndshare.sources_text;

CREATE TABLE dndshare.sources_text (
                                       id int8 NOT NULL,
                                       lang text NULL,
                                       "name" text NULL,
                                       description text NULL,
                                       CONSTRAINT sources_text_pk PRIMARY KEY (id)
);


-- dndshare.spells определение

-- Drop table

-- DROP TABLE dndshare.spells;

CREATE TABLE dndshare.spells (
                                 id int8 DEFAULT nextval('dndshare.spells_text_id_seq'::regclass) NOT NULL,
                                 id_t text NULL,
                                 lvl int4 NULL,
                                 c_v bool NULL,
                                 c_s bool NULL,
                                 school int8 NULL,
                                 classes _int8 NULL,
                                 user_id int8 NULL,
                                 concentration bool NULL,
                                 "source" int8 NULL,
                                 ritual bool NULL
);


-- dndshare.spells_text определение

-- Drop table

-- DROP TABLE dndshare.spells_text;

CREATE TABLE dndshare.spells_text (
                                      id int8 DEFAULT nextval('dndshare.spells_id_seq'::regclass) NOT NULL,
                                      lang text NULL,
                                      "name" text NULL,
                                      description text NULL,
                                      c_m text NULL,
                                      "time" text NULL,
                                      "range" text NULL,
                                      duration text NULL,
                                      CONSTRAINT spells_pk UNIQUE (id, lang)
);
CREATE INDEX spells_name_index ON dndshare.spells_text USING btree (name);


-- dndshare.char определение

-- Drop table

-- DROP TABLE dndshare.char;

CREATE TABLE dndshare.char (
                               id bigserial NOT NULL,
                               "uuid" uuid DEFAULT gen_random_uuid() NOT NULL,
                               user_id int8 NOT NULL,
                               template_id int8 NOT NULL,
                               "data" jsonb NOT NULL,
                               public_visible bool DEFAULT true NOT NULL,
                               created_at timestamptz DEFAULT now() NOT NULL,
                               changed_at timestamptz DEFAULT now() NOT NULL,
                               CONSTRAINT char_pk PRIMARY KEY (id),
                               CONSTRAINT char_uuid_key UNIQUE (uuid),
                               CONSTRAINT char_char_template_fk FOREIGN KEY (template_id) REFERENCES dndshare.char_template(id)
);