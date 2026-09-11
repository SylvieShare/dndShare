-- SRD 5.1: refresh public magical weapons using the existing dependency contract.
-- Never change authored descriptions, costs, links, or instance state by name inference.
WITH changes AS (SELECT * FROM jsonb_to_recordset($resources$[
  {
    "id": 108,
    "name": "Посох лечения",
    "patch": {
      "max_use": 10,
      "dawn_recovery": {
        "mode": "roll",
        "formula": "1d6+4"
      }
    }
  },
  {
    "id": 131,
    "name": "Посох огня",
    "patch": {
      "max_use": 10,
      "dawn_recovery": {
        "mode": "roll",
        "formula": "1d6+4"
      }
    }
  },
  {
    "id": 132,
    "name": "Посох очарования",
    "patch": {
      "max_use": 10,
      "dawn_recovery": {
        "mode": "roll",
        "formula": "1d8+2"
      }
    }
  },
  {
    "id": 164,
    "name": "Посох силы",
    "patch": {
      "max_use": 20,
      "dawn_recovery": {
        "mode": "roll",
        "formula": "2d8+4"
      }
    }
  },
  {
    "id": 168,
    "name": "Посох лесов",
    "patch": {
      "max_use": 10,
      "dawn_recovery": {
        "mode": "roll",
        "formula": "1d6+4"
      }
    }
  },
  {
    "id": 176,
    "name": "Посох роя насекомых",
    "patch": {
      "max_use": 10,
      "dawn_recovery": {
        "mode": "roll",
        "formula": "1d6+4"
      }
    }
  },
  {
    "id": 189,
    "name": "Посох ударов",
    "patch": {
      "max_use": 10,
      "dawn_recovery": {
        "mode": "roll",
        "formula": "1d6+4"
      }
    }
  },
  {
    "id": 197,
    "name": "Молот громовых ударов",
    "patch": {
      "max_use": 5,
      "dawn_recovery": {
        "mode": "roll",
        "formula": "1d4+1"
      }
    }
  },
  {
    "id": 249,
    "name": "Посох магов",
    "patch": {
      "max_use": 50,
      "dawn_recovery": {
        "mode": "roll",
        "formula": "4d6+2"
      }
    }
  },
  {
    "id": 284,
    "name": "Метательное копьё молнии",
    "patch": {
      "max_use": 1,
      "dawn_recovery": {
        "mode": "full"
      }
    }
  },
  {
    "id": 297,
    "name": "Посох мороза",
    "patch": {
      "max_use": 10,
      "dawn_recovery": {
        "mode": "roll",
        "formula": "1d6+4"
      }
    }
  }
]$resources$::jsonb) AS x(id bigint,name text,patch jsonb))
UPDATE dndshare.item i SET data=i.data || c.patch FROM changes c
WHERE i.id=c.id AND i.name=c.name AND i.type_id=19 AND i.user_id IS NULL
 AND NOT(i.data ? 'max_use') AND NOT(i.data ? 'dawn_recovery')
 AND COALESCE(i.data->'use_resources','[]'::jsonb)='[]'::jsonb;

-- Append one dependency per entry, preserving existing keys and their authored content.
DO $refresh$
DECLARE spec record; section record; existing jsonb; missing jsonb; current_data jsonb;
BEGIN
 FOR spec IN SELECT * FROM jsonb_to_recordset($additions$[
  {
    "id": 88,
    "name": "Посох грома и молнии",
    "patch": {
      "use_resources": [
        {
          "key": "lightning",
          "title": "Молния",
          "max_use": 1,
          "dawn_recovery": {
            "mode": "full"
          }
        },
        {
          "key": "thunder",
          "title": "Гром",
          "max_use": 1,
          "dawn_recovery": {
            "mode": "full"
          }
        },
        {
          "key": "lightning_strike",
          "title": "Удар молнии",
          "max_use": 1,
          "dawn_recovery": {
            "mode": "full"
          }
        },
        {
          "key": "thunderclap",
          "title": "Раскат грома",
          "max_use": 1,
          "dawn_recovery": {
            "mode": "full"
          }
        },
        {
          "key": "thunder_lightning",
          "title": "Гром и молния",
          "max_use": 1,
          "dawn_recovery": {
            "mode": "full"
          }
        }
      ],
      "feature_actions": [
        {
          "key": "thunder",
          "title": "Гром при попадании",
          "action_type": "special",
          "description": "<p>Посох издаёт гром, слышимый в пределах 300 футов. При провале спасброска Телосложения Сл 17 поражённая цель ошеломлена до конца вашего следующего хода.</p>",
          "requirements": [
            "При попадании рукопашной атакой этим посохом."
          ],
          "uses_resource": true,
          "resource_key": "thunder",
          "resource_cost": 1
        },
        {
          "key": "lightning_strike",
          "title": "Удар молнии",
          "action_type": "action",
          "description": "<p>Из посоха вырывается молния: <span data-rich-node=\"dice\" data-rich-payload=\"%7B%22formula%22%3A%229d6%22%7D\" contenteditable=\"false\">9d6</span> урона молнией.</p>",
          "requirements": [
            "Линия длиной 120 и шириной 5 футов.",
            "Все существа в линии: спасбросок Ловкости Сл 17, половина урона при успехе."
          ],
          "uses_resource": true,
          "resource_key": "lightning_strike",
          "resource_cost": 1
        },
        {
          "key": "thunderclap",
          "title": "Раскат грома",
          "action_type": "action",
          "description": "<p>Посох издаёт гром: <span data-rich-node=\"dice\" data-rich-payload=\"%7B%22formula%22%3A%222d6%22%7D\" contenteditable=\"false\">2d6</span> урона звуком. При провале спасброска цель также теряет слух на 1 минуту.</p>",
          "requirements": [
            "Все существа в пределах 60 футов, кроме вас.",
            "Спасбросок Телосложения Сл 17: половина урона и без глухоты при успехе.",
            "Звук слышен в пределах 600 футов."
          ],
          "uses_resource": true,
          "resource_key": "thunderclap",
          "resource_cost": 1
        },
        {
          "key": "thunder_lightning",
          "title": "Гром и молния",
          "action_type": "action",
          "description": "<p>Одновременно примените «Удар молнии» (<span data-rich-node=\"dice\" data-rich-payload=\"%7B%22formula%22%3A%229d6%22%7D\" contenteditable=\"false\">9d6</span> молнией) и «Раскат грома» (<span data-rich-node=\"dice\" data-rich-payload=\"%7B%22formula%22%3A%222d6%22%7D\" contenteditable=\"false\">2d6</span> звуком).</p>",
          "requirements": [
            "Молния: линия 120 × 5 футов, спасбросок Ловкости Сл 17.",
            "Гром: радиус 60 футов, кроме вас; спасбросок Телосложения Сл 17, глухота на 1 минуту при провале.",
            "Каждый успешный спасбросок уменьшает соответствующий урон вдвое.",
            "Не расходует отдельные использования «Удара молнии» и «Раската грома»."
          ],
          "uses_resource": true,
          "resource_key": "thunder_lightning",
          "resource_cost": 1
        }
      ],
      "weapon_damage": [
        {
          "key": "lightning",
          "label": "Молния",
          "dice": "d6",
          "dice_count": 2,
          "damage_type": 9,
          "weapon_kind": "melee",
          "uses_resource": true,
          "resource_key": "lightning",
          "resource_cost": 1,
          "double_on_critical": true,
          "condition": "При попадании рукопашной атакой этим посохом."
        }
      ]
    }
  },
  {
    "id": 164,
    "name": "Посох силы",
    "patch": {
      "weapon_damage": [
        {
          "key": "power_strike",
          "label": "Мощный удар",
          "dice": "d6",
          "dice_count": 1,
          "damage_type": 12,
          "weapon_kind": "melee",
          "uses_resource": true,
          "resource_cost": 1,
          "double_on_critical": true,
          "condition": "При попадании рукопашной атакой этим посохом."
        }
      ]
    }
  },
  {
    "id": 149,
    "name": "Кинжал яда",
    "patch": {
      "weapon_damage": [
        {
          "key": "venom",
          "label": "Яд кинжала",
          "dice": "d10",
          "dice_count": 2,
          "damage_type": 4,
          "double_on_critical": false,
          "condition": "Первое попадание после покрытия кинжала ядом, пока не прошла 1 минута; цель провалила спасбросок Телосложения Сл 15. Не включайте при следующих попаданиях. Ресурс уже потрачен на покрытие клинка."
        }
      ]
    }
  }
]$additions$::jsonb) AS x(id bigint,name text,patch jsonb) LOOP
  SELECT data INTO current_data FROM dndshare.item WHERE id=spec.id AND name=spec.name AND type_id=19 AND user_id IS NULL;
  IF NOT FOUND THEN CONTINUE; END IF;
  -- Five independent powers cannot be combined with a custom, already-defined pool.
  IF spec.id=88 AND (current_data ? 'max_use' OR
    (COALESCE(current_data->'use_resources','[]'::jsonb)<>'[]'::jsonb AND
     current_data->'use_resources'<>spec.patch->'use_resources')) THEN CONTINUE; END IF;
  FOR section IN SELECT key,value FROM jsonb_each(spec.patch) LOOP
   existing := COALESCE(current_data->section.key,'[]'::jsonb);
   IF jsonb_typeof(existing)<>'array' THEN CONTINUE; END IF;
   SELECT COALESCE(jsonb_agg(value ORDER BY ord),'[]'::jsonb) INTO missing
   FROM jsonb_array_elements(section.value) WITH ORDINALITY added(value,ord)
   WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(existing) old WHERE old->>'key'=added.value->>'key');
   current_data := jsonb_set(current_data,ARRAY[section.key],existing || missing);
  END LOOP;
  UPDATE dndshare.item SET data=current_data WHERE id=spec.id;
 END LOOP;
END $refresh$;

WITH changes AS (SELECT * FROM jsonb_to_recordset($damage_types$[
  {
    "id": 104,
    "key": "holy_damage",
    "damage_type": 7
  },
  {
    "id": 136,
    "key": "flame",
    "damage_type": 5
  },
  {
    "id": 137,
    "key": "smiting",
    "damage_type": 3
  },
  {
    "id": 137,
    "key": "smiting_construct",
    "damage_type": 3
  },
  {
    "id": 148,
    "key": "frost",
    "damage_type": 13
  },
  {
    "id": 160,
    "key": "sharpness",
    "damage_type": 2
  },
  {
    "id": 190,
    "key": "disruption",
    "damage_type": 7
  },
  {
    "id": 198,
    "key": "vorpal",
    "damage_type": 2
  },
  {
    "id": 202,
    "key": "sworn_enemy",
    "damage_type": 1
  },
  {
    "id": 263,
    "key": "undead",
    "damage_type": 7
  },
  {
    "id": 293,
    "key": "life_stealing",
    "damage_type": 10
  }
]$damage_types$::jsonb) AS x(id bigint,key text,damage_type int))
UPDATE dndshare.item i SET data=jsonb_set(i.data,'{weapon_damage}',
 (SELECT jsonb_agg(CASE WHEN c.key IS NOT NULL AND NOT (r ? 'damage_type') THEN r || jsonb_build_object('damage_type',c.damage_type) ELSE r END ORDER BY ord)
 FROM jsonb_array_elements(i.data->'weapon_damage') WITH ORDINALITY rows(r,ord)
 LEFT JOIN changes c ON c.id=i.id AND c.key=r->>'key'))
WHERE i.type_id=19 AND i.user_id IS NULL AND jsonb_typeof(i.data->'weapon_damage')='array'
 AND jsonb_array_length(i.data->'weapon_damage')>0 AND i.id IN(SELECT id FROM changes);

INSERT INTO dndshare.item(name,name_en,type_id,data)
SELECT 'Ужас булавы','Mace of Terror',15,$terror${
  "code": "mace_terror",
  "desc": "<p>Вы испуганы владельцем булавы на 1 минуту. Пока видите источник испуга, совершаете проверки характеристик и броски атаки с помехой.</p><p>В свой ход пытайтесь уйти как можно дальше от владельца. Нельзя добровольно приблизиться к нему ближе чем на 30 футов или совершать реакции.</p><p>Действием можно только совершить Рывок либо освободиться от того, что мешает движению. Если двигаться некуда, можно совершить Уклонение.</p><p>В конце каждого своего хода повторите спасбросок Мудрости Сл 15. При успехе эффект заканчивается.</p>",
  "polarity": "negative",
  "color": "#f87171",
  "stacking": "single",
  "duration": {
    "kind": "minutes",
    "value": 1
  }
}$terror$::jsonb
WHERE EXISTS(SELECT 1 FROM dndshare.item WHERE id=273 AND name='Булава ужаса' AND type_id=19 AND user_id IS NULL)
 AND NOT EXISTS(SELECT 1 FROM dndshare.item WHERE type_id=15 AND user_id IS NULL AND data->>'code'='mace_terror');

WITH changes AS (SELECT * FROM jsonb_to_recordset($links$[
  {
    "id": 88,
    "name": "Посох грома и молнии",
    "key": "thunder_stun",
    "code": "stunned",
    "condition": "Использован «Гром» при попадании посохом; цель провалила спасбросок Телосложения Сл 17. До конца вашего следующего хода."
  },
  {
    "id": 88,
    "name": "Посох грома и молнии",
    "key": "thunder_deafness",
    "code": "deafened",
    "condition": "Использован «Раскат грома» или «Гром и молния»; цель провалила спасбросок Телосложения Сл 17. Глухота на 1 минуту."
  },
  {
    "id": 149,
    "name": "Кинжал яда",
    "key": "venom",
    "code": "poisoned",
    "damage_key": "venom",
    "condition": "Первое попадание покрытым ядом кинжалом в течение 1 минуты; провал спасброска Телосложения Сл 15. Отравление на 1 минуту."
  },
  {
    "id": 182,
    "name": "Убийца великанов",
    "key": "giant_prone",
    "code": "prone",
    "damage_key": "giant_slayer",
    "condition": "Попадание по великану; провал спасброска Силы Сл 15. Эффект прекращается, когда цель встаёт."
  },
  {
    "id": 190,
    "name": "Булава разрушения",
    "key": "disruption_fear",
    "code": "frightened",
    "damage_key": "disruption",
    "condition": "Попадание по исчадию или нежити; после урона осталось не больше 25 хитов; успех спасброска Мудрости Сл 15. Испуг до конца вашего следующего хода. При провале цель уничтожена."
  },
  {
    "id": 197,
    "name": "Молот громовых ударов",
    "key": "thunder_stun",
    "code": "stunned",
    "condition": "Попадание особым метанием за 1 заряд; цель или существо в пределах 30 футов от неё провалило спасбросок Телосложения Сл 17. До конца вашего следующего хода."
  },
  {
    "id": 273,
    "name": "Булава ужаса",
    "key": "terror",
    "code": "mace_terror",
    "condition": "«Волна ужаса» за 1 заряд; выбранное существо в пределах 30 футов провалило спасбросок Мудрости Сл 15."
  }
]$links$::jsonb) AS x(id bigint,name text,key text,code text,damage_key text,condition text))
UPDATE dndshare.item i SET data=jsonb_set(i.data,'{status_effects}',COALESCE(i.data->'status_effects','[]'::jsonb) ||
 (SELECT COALESCE(jsonb_agg(jsonb_strip_nulls(jsonb_build_object('key',c.key,'effect',jsonb_build_object('id',effect.id),
  'target','other','condition',c.condition,'weapon_damage_key',c.damage_key)) ORDER BY c.key),'[]'::jsonb)
  FROM changes c JOIN LATERAL (SELECT id FROM dndshare.item WHERE type_id=15 AND user_id IS NULL AND data->>'code'=c.code ORDER BY id LIMIT 1) effect ON true
  WHERE c.id=i.id AND c.name=i.name AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(i.data->'status_effects','[]'::jsonb)) old WHERE old->>'key'=c.key)))
WHERE i.type_id=19 AND i.user_id IS NULL AND i.id IN(SELECT id FROM changes)
 AND jsonb_typeof(COALESCE(i.data->'status_effects','[]'::jsonb))='array';

UPDATE dndshare.item i SET data=jsonb_set(i.data,'{feature_actions}',
 (SELECT jsonb_agg(CASE WHEN a->>'key'='apply_poison' AND jsonb_typeof(a->'requirements')='array' AND jsonb_array_length(a->'requirements')>0 THEN jsonb_set(a,'{requirements}',
  (SELECT jsonb_agg(CASE WHEN v='"Бросок урона ядом выполняется отдельно, без удвоения при крите."'::jsonb
   THEN '"При провале спасброска включите «Яд кинжала» в меню урона; при крите эти кости не удваиваются."'::jsonb ELSE v END ORDER BY n)
   FROM jsonb_array_elements(a->'requirements') WITH ORDINALITY requirements(v,n))) ELSE a END ORDER BY ord)
 FROM jsonb_array_elements(i.data->'feature_actions') WITH ORDINALITY actions(a,ord)))
WHERE i.id=149 AND i.name='Кинжал яда' AND i.type_id=19 AND i.user_id IS NULL
 AND i.data->'feature_actions' @> '[{"key":"apply_poison","requirements":["Бросок урона ядом выполняется отдельно, без удвоения при крите."]}]'::jsonb;
