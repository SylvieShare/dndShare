export default {
  "resources": {
    "id": "resources",
    "type": "BLOCK_RESOURCES",
    "content": {
      "max_in_row": 10
    }
  },
  "feature_widgets": {
    "id": "feature_widgets",
    "type": "DND_FEATURE_WIDGETS",
    "content": {}
  },
  "actions": {
    "id": "actions",
    "type": "DND_ACTIONS",
    "content": {}
  },
  "defenses": {
    "id": "defenses",
    "type": "DND_DEFENSES",
    "content": {
      "damage_type_suggest_id": 12
    }
  },
  "proficiencies": {
    "id": "proficiencies",
    "type": "BLOCK_TAGS",
    "content": {
      "gap": "10px",
      "fixed_list": [
        {
          "title": "Доспехи",
          "suggest_id": 3
        },
        {
          "title": "Оружие",
          "suggest_id": 4
        },
        {
          "title": "Инструменты",
          "suggest_id": 5
        },
        {
          "title": "Языки",
          "suggest_id": 6
        }
      ],
      "custom_tags": true,
      "custom_suggest_id": 10
    }
  },
  "abilities_race": {
    "id": "abilities_race",
    "type": "DND_ABILITIES",
    "title": "Расовые",
    "content": {
      "item_id": 3
    }
  },
  "abilities_class": {
    "id": "abilities_class",
    "type": "DND_ABILITIES",
    "title": "Классовые",
    "content": {
      "item_id": 4
    }
  },
  "abilities_story": {
    "id": "abilities_story",
    "type": "DND_ABILITIES",
    "title": "Сюжетные",
    "content": {
      "item_id": 18,
      "hide_empty": true
    }
  },
  "abilities_feats": {
    "id": "abilities_feats",
    "type": "DND_ABILITIES",
    "title": "Черты",
    "content": {
      "item_id": 7
    }
  }
}
