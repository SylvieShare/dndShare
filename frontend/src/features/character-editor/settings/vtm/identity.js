export default {
  "char_name": {
    "id": "char_name",
    "type": "INPUT_TEXT",
    "content": {
      "color": "#c8a04a",
      "placeholder": "Имя персонажа"
    }
  },
  "ava": {
    "id": "ava",
    "type": "AVATARS",
    "content": {
      "width": 220,
      "height": 360
    }
  },
  "clan": {
    "id": "clan",
    "type": "INPUT_TEXT",
    "content": {
      "placeholder": "Клан"
    }
  },
  "nature": {
    "id": "nature",
    "type": "INPUT_TEXT",
    "content": {
      "placeholder": "Натура"
    },
    "title": "Натура:"
  },
  "mask": {
    "id": "mask",
    "type": "INPUT_TEXT",
    "content": {
      "placeholder": "Маска"
    },
    "title": "Маска:"
  },
  "persona": {
    "id": "persona",
    "type": "INPUT_TEXT",
    "content": {
      "placeholder": "Амплуа"
    },
    "title": "Амплуа:"
  },
  "sire": {
    "id": "sire",
    "type": "INPUT_TEXT",
    "content": {
      "placeholder": "Сир"
    },
    "title": "Сир:"
  },
  "health": {
    "id": "health",
    "type": "VTM_HEALTH"
  },
  "xp_total": {
    "id": "xp_total",
    "type": "INPUT_INT_BLOCK",
    "title": "Всего"
  },
  "xp_spent": {
    "id": "xp_spent",
    "type": "INPUT_INT_BLOCK",
    "title": "Потрачено"
  },
  "money": {
    "id": "money",
    "type": "BLOCK_MONEY",
    "preset": [
      {
        "id": 1,
        "title": "Доллары",
        "short_title": "$",
        "color": "var(--success)",
        "amount": 0
      }
    ]
  },
  "blood_pool": {
    "id": "blood_pool",
    "type": "VTM_BLOOD_POOL",
    "content": {
      "default": 20,
      "in_row": 10
    }
  },
  "clan_weakness": {
    "id": "clan_weakness",
    "type": "INPUT_DESCRIPTION",
    "title": "Слабость клана",
    "content": {
      "placeholder": "Слабость клана..."
    }
  },
  "notes": {
    "id": "notes",
    "type": "INPUT_DESCRIPTION",
    "title": "Заметки",
    "content": {
      "placeholder": "Заметки..."
    }
  }
}
