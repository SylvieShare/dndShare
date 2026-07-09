-- Seed characteristic icons into svg_storage and attach to suggests (type 16).
-- Generated from resources/stat-icons/*.svg. Re-running inserts fresh svg_storage rows.
BEGIN;

-- Сила (suggest id 1)
WITH s AS (INSERT INTO dndshare.svg_storage (data) VALUES ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6M7 6.5v11M17 6.5v11M20 9v6M7 12h10"/></svg>') RETURNING id)
UPDATE dndshare.suggest SET svg_id = (SELECT id FROM s) WHERE id = 1 AND type_id = 16;

-- Ловкость (suggest id 2)
WITH s AS (INSERT INTO dndshare.svg_storage (data) VALUES ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>') RETURNING id)
UPDATE dndshare.suggest SET svg_id = (SELECT id FROM s) WHERE id = 2 AND type_id = 16;

-- Выносливость (suggest id 3)
WITH s AS (INSERT INTO dndshare.svg_storage (data) VALUES ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20C12 20 4 14.5 4 8.5C4 6 6 4 8.5 4C10 4 11.3 4.8 12 6C12.7 4.8 14 4 15.5 4C18 4 20 6 20 8.5C20 14.5 12 20 12 20Z"/></svg>') RETURNING id)
UPDATE dndshare.suggest SET svg_id = (SELECT id FROM s) WHERE id = 3 AND type_id = 16;

-- Интеллект (suggest id 4)
WITH s AS (INSERT INTO dndshare.svg_storage (data) VALUES ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 7C10.5 6 8 5.5 6 5.5S2.8 5.8 2 6.2v12.3c.8-.4 2-.7 4-.7s4.5.5 6 1.5c1.5-1 4-1.5 6-1.5s3.2.3 4 .7V6.2c-.8-.4-2-.7-4-.7s-4.5.5-6 1.5zm0 0v12"/></svg>') RETURNING id)
UPDATE dndshare.suggest SET svg_id = (SELECT id FROM s) WHERE id = 4 AND type_id = 16;

-- Мудрость (suggest id 5)
WITH s AS (INSERT INTO dndshare.svg_storage (data) VALUES ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>') RETURNING id)
UPDATE dndshare.suggest SET svg_id = (SELECT id FROM s) WHERE id = 5 AND type_id = 16;

-- Харизма (suggest id 6)
WITH s AS (INSERT INTO dndshare.svg_storage (data) VALUES ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-3.5c2.2-1 3.7-3.2 3.7-5.8C23.7 8.2 20.5 5 16.6 5c-3.4 0-6.3 2.4-6.9 5.7l-.8 4.1c-.1.7.4 1.4 1.2 1.4h1.4v1.3c0 1 .8 1.8 1.8 1.8H16v1.7"/></svg>') RETURNING id)
UPDATE dndshare.suggest SET svg_id = (SELECT id FROM s) WHERE id = 6 AND type_id = 16;

COMMIT;
