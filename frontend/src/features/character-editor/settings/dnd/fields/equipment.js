export default {
  "items": {
    "id": "items",
    "type": "BLOCK_ITEMS",
    "content": {
      "item_type_id": 2,
      "include_related_types": true,
      "specialized_destinations": [
        {
          "type_id": 1,
          "value_id": "weapon",
          "label": "Оружие"
        }
      ],
      "tool_type_id": 14,
      "wallet": {
        "value_id": "money",
        "suggest_type_id": 17
      }
    }
  },
  "notes": {
    "id": "notes",
    "type": "INPUT_DESCRIPTION",
    "title": "Заметки",
    "content": {
      "placeholder": "Заметки..."
    }
  },
  "quests": {
    "id": "quests",
    "type": "DND_QUESTS",
    "content": {}
  },
  "diary": {
    "id": "diary",
    "type": "DND_DIARY",
    "content": {}
  },
  "spells": {
    "id": "spells",
    "type": "DND_SPELLS",
    "content": {
      "item_type_id": 5,
      "prof_bonus_path": "prof_bonus.v",
      "school_suggest_id": 7,
      "stat_suggest_type_id": 16
    },
    "hide_on_empty": true
  },
  "weapon": {
    "id": "weapon",
    "type": "DND_WEAPONS",
    "content": {
      "bonus_path": "prof_bonus.v",
      "item_type_id": 1,
      "stat_suggest_type_id": 16,
      "type_attack_suggest_type_id": 12
    }
  },
  "campaign": {
    "id": "campaign",
    "type": "CAMPAIGN_BADGE",
    "content": {}
  }
}
