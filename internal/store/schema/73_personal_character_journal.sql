-- Personal ownership is independent of the currently selected source: choosing
-- a session journal must not orphan the character's personal chronicle.
ALTER TABLE dndshare.journal
    ADD COLUMN personal_char_id int8 REFERENCES dndshare."char"(id) ON DELETE CASCADE;

-- Restore the original Lissara's complete migrated journal. The second journal
-- belongs to a separate copy of the character; leave both journals and all their
-- sections/entries intact. Match immutable UUIDs and verify the same owner.
UPDATE dndshare.journal journal
SET personal_char_id = character.id
FROM dndshare."char" character
WHERE journal.uuid = '95cba40e-807d-463d-9f80-9e43b8c0a0b4'
  AND character.uuid = 'cc503ec7-8250-4c00-a9a4-b830f39cdaf1'
  AND journal.owner_user_id = character.user_id;

UPDATE dndshare.character_journal link
SET journal_id = original.id, linked_at = now()
FROM dndshare.journal original, dndshare.journal selected
WHERE original.uuid = '95cba40e-807d-463d-9f80-9e43b8c0a0b4'
  AND original.personal_char_id = link.char_id
  AND selected.id = link.journal_id
  AND selected.uuid = '690207c5-4770-4e09-b9b2-1f2d08be59ef'
  AND selected.owner_user_id = original.owner_user_id;

-- Only infer ownership from an unambiguous existing personal link. Constraints
-- below deliberately abort rather than silently hide or reassign ambiguous data.
UPDATE dndshare.journal journal
SET personal_char_id = ownership.char_id
FROM (
    SELECT link.journal_id, min(link.char_id) AS char_id
    FROM dndshare.character_journal link
    JOIN dndshare."char" character ON character.id = link.char_id
    JOIN dndshare.journal source ON source.id = link.journal_id
    WHERE source.owner_user_id = character.user_id
    GROUP BY link.journal_id
    HAVING count(*) = 1
) ownership
WHERE journal.id = ownership.journal_id AND journal.personal_char_id IS NULL;

ALTER TABLE dndshare.journal
    ADD CONSTRAINT journal_personal_character_key UNIQUE (personal_char_id),
    ADD CONSTRAINT journal_personal_character_check
        CHECK ((owner_user_id IS NULL) = (personal_char_id IS NULL));
