export default {
  "hp": {
    "id": "hp",
    "type": "DND_HP"
  },
  "character_icon": {
    "id": "character_icon",
    "type": "DND_CHARACTER_ICON"
  },
  "name": {
    "id": "name",
    "type": "INPUT_TEXT",
    "content": {
      "color": "#fcbe24",
      "placeholder": "Имя персонажа"
    }
  },
  "race": {
    "id": "race",
    "type": "INPUT_ITEM",
    "content": {
      "item_type": 8,
      "placeholder": "Раса",
      "child_id": "subrace",
      "child_item_type": 16,
      "child_parent_key": "race",
      "child_placeholder": "Без происхождения",
      "child_display": "replace"
    }
  },
  "class": {
    "id": "class",
    "type": "INPUT_ITEM",
    "content": {
      "item_type": 9,
      "placeholder": "Класс",
      "child_id": "subclass",
      "child_item_type": 17,
      "child_parent_key": "class",
      "child_placeholder": "Без архетипа",
      "child_display": "paren"
    }
  },
  "mobile_statuses": {
    "id": "mobile_statuses",
    "type": "DND_MOBILE_STATUS_MENU",
    "content": {
      "states_id": "states",
      "effect_item_type_id": 15,
      "exhaustion_id": "exhaustion",
      "inspiration_id": "inspiration"
    }
  },
  "desktop_statuses": {
    "id": "desktop_statuses",
    "type": "DND_STATUS_OVERVIEW",
    "content": {
      "states_id": "states",
      "effect_item_type_id": 15,
      "exhaustion_id": "exhaustion",
      "inspiration_id": "inspiration",
      "display": "summary"
    }
  },
  "desktop_status_trigger": {
    "id": "desktop_status_trigger",
    "type": "DND_STATUS_OVERVIEW",
    "content": {
      "states_id": "states",
      "effect_item_type_id": 15,
      "exhaustion_id": "exhaustion",
      "inspiration_id": "inspiration",
      "display": "trigger"
    }
  },
  "char_identity": {
    "id": "char_identity",
    "type": "DND_CHAR_IDENTITY",
    "content": {
      "name_id": "name",
      "race_id": "race"
    }
  },
  "read_only_notice": {
    "id": "read_only_notice",
    "type": "CHARACTER_READ_ONLY"
  }
}
