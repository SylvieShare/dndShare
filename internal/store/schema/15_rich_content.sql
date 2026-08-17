-- Item 1635 is the agreed migration example for the rich-node contract. Its
-- imported source-site widgets become native DnD Share nodes. The replacements
-- are exact and idempotent so unrelated legacy HTML remains untouched.
UPDATE dndshare.item
SET data = jsonb_set(
    jsonb_set(
        jsonb_set(
            data,
            '{feats,0,value}',
            to_jsonb(replace(
                data #>> '{feats,0,value}',
                '<detail-tooltip type="screen"><a href="/screens/perception"><em>Мудрости (Внимательность)</em></a></detail-tooltip>',
                '<span data-rich-node="suggest" data-rich-payload="%7B%22id%22%3A10%2C%22typeId%22%3A15%7D" contenteditable="false">Мудрости (Внимательность)</span>'
            )),
            false
        ),
        '{actions,0,value}',
        to_jsonb(replace(replace(
            data #>> '{actions,0,value}',
            '<dice-roller label="Атака" formula="к20 + 4">+4</dice-roller>',
            '<span data-rich-node="dice" data-rich-payload="%7B%22formula%22%3A%22%D0%BA20%20%2B%204%22%2C%22label%22%3A%22%D0%90%D1%82%D0%B0%D0%BA%D0%B0%22%7D" contenteditable="false">Атака: к20 + 4</span>'
        ),
            '<dice-roller label="Урон" formula="1к4 + 2"/>',
            '<span data-rich-node="dice" data-rich-payload="%7B%22formula%22%3A%221%D0%BA4%20%2B%202%22%2C%22label%22%3A%22%D0%A3%D1%80%D0%BE%D0%BD%22%7D" contenteditable="false">Урон: 1к4 + 2</span>'
        )),
        false
    ),
    '{actions,1,value}',
    to_jsonb(replace(replace(
        data #>> '{actions,1,value}',
        '<dice-roller label="Атака" formula="к20 + 4">+4</dice-roller>',
        '<span data-rich-node="dice" data-rich-payload="%7B%22formula%22%3A%22%D0%BA20%20%2B%204%22%2C%22label%22%3A%22%D0%90%D1%82%D0%B0%D0%BA%D0%B0%22%7D" contenteditable="false">Атака: к20 + 4</span>'
    ),
        '<dice-roller label="Урон" formula="1к4 + 2"/>',
        '<span data-rich-node="dice" data-rich-payload="%7B%22formula%22%3A%221%D0%BA4%20%2B%202%22%2C%22label%22%3A%22%D0%A3%D1%80%D0%BE%D0%BD%22%7D" contenteditable="false">Урон: 1к4 + 2</span>'
    )),
    false
)
WHERE id = 1635
  AND jsonb_typeof(data -> 'feats') = 'array'
  AND jsonb_typeof(data -> 'actions') = 'array'
  AND jsonb_array_length(data -> 'feats') > 0
  AND jsonb_array_length(data -> 'actions') > 1;

-- The kobold damage average belongs to the roll node itself. Remove the
-- imported external "4 (formula)" layout and persist the manually editable
-- average in the node payload for both attacks.
UPDATE dndshare.item
SET data = jsonb_set(
    jsonb_set(
        data,
        '{actions,0,value}',
        to_jsonb(replace(
            data #>> '{actions,0,value}',
            '<em>Попадание:</em>&nbsp;4&nbsp;(<span data-rich-node="dice" data-rich-payload="%7B%22formula%22%3A%221%D0%BA4%20%2B%202%22%2C%22label%22%3A%22%D0%A3%D1%80%D0%BE%D0%BD%22%7D" contenteditable="false">Урон: 1к4 + 2</span>)',
            '<em>Попадание:</em> <span data-rich-node="dice" data-rich-payload="%7B%22formula%22%3A%221%D0%BA4%20%2B%202%22%2C%22label%22%3A%22%D0%A3%D1%80%D0%BE%D0%BD%22%2C%22average%22%3A4%7D" contenteditable="false">Урон: 4 · 1к4 + 2</span>'
        )),
        false
    ),
    '{actions,1,value}',
    to_jsonb(replace(
        data #>> '{actions,1,value}',
        '<em>Попадание:</em>&nbsp;4&nbsp;(<span data-rich-node="dice" data-rich-payload="%7B%22formula%22%3A%221%D0%BA4%20%2B%202%22%2C%22label%22%3A%22%D0%A3%D1%80%D0%BE%D0%BD%22%7D" contenteditable="false">Урон: 1к4 + 2</span>)',
        '<em>Попадание:</em> <span data-rich-node="dice" data-rich-payload="%7B%22formula%22%3A%221%D0%BA4%20%2B%202%22%2C%22label%22%3A%22%D0%A3%D1%80%D0%BE%D0%BD%22%2C%22average%22%3A4%7D" contenteditable="false">Урон: 4 · 1к4 + 2</span>'
    )),
    false
)
WHERE id = 1635
  AND jsonb_typeof(data -> 'actions') = 'array'
  AND jsonb_array_length(data -> 'actions') > 1;
