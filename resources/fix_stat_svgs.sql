-- In-place fix for two characteristic icons (type 16):
--   Выносливость (suggest id 3) — symmetric heart (old one had a dent on the right lobe).
--   Харизма (suggest id 6) — left-facing profile head (replaces the star).
-- Updates the existing svg_storage rows via the suggest join, so svg_id stays the same.
BEGIN;

UPDATE dndshare.svg_storage ss
SET data = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20C12 20 4 14.5 4 8.5C4 6 6 4 8.5 4C10 4 11.3 4.8 12 6C12.7 4.8 14 4 15.5 4C18 4 20 6 20 8.5C20 14.5 12 20 12 20Z"/></svg>'
FROM dndshare.suggest s
WHERE s.svg_id = ss.id AND s.type_id = 16 AND s.id = 3;

UPDATE dndshare.svg_storage ss
SET data = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-3.5c2.2-1 3.7-3.2 3.7-5.8C23.7 8.2 20.5 5 16.6 5c-3.4 0-6.3 2.4-6.9 5.7l-.8 4.1c-.1.7.4 1.4 1.2 1.4h1.4v1.3c0 1 .8 1.8 1.8 1.8H16v1.7"/></svg>'
FROM dndshare.suggest s
WHERE s.svg_id = ss.id AND s.type_id = 16 AND s.id = 6;

COMMIT;
