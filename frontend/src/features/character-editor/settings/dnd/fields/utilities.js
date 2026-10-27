export default {
  "lvl": {
    "id": "lvl",
    "type": "BLOCK_LVL",
    "content": {
      "experience": [
        300,
        900,
        2700,
        6500,
        14000,
        23000,
        34000,
        48000,
        64000,
        85000,
        100000,
        120000,
        140000,
        165000,
        195000,
        225000,
        265000,
        305000,
        355000
      ]
    }
  },
  "armor": {
    "id": "armor",
    "type": "DND_ARMOR",
    "content": {
      "dex_mod_path": "values.DEX.mod",
      "svg": "/static/shield.svg",
      "accent": "#4f8fcc"
    }
  },
  "settings": {
    "id": "settings",
    "type": "SETTINGS_MENU",
    "content": {
      "svg": "/static/settings.svg",
      "accent": "#8a8f9e"
    }
  },
  "rest": {
    "id": "rest",
    "type": "DND_REST",
    "content": {
      "hp_id": "hp",
      "spells_id": "spells",
      "resources_id": "resources",
      "exhaustion_id": "exhaustion",
      "con_id": "CON"
    }
  },
  "speed": {
    "id": "speed",
    "type": "DND_SPEED",
    "content": {
      "svg": "/static/speed.svg",
      "accent": "#4bb3b8"
    }
  },
  "initiative": {
    "id": "initiative",
    "type": "DND_INITIATIVE",
    "content": {
      "dex_mod_path": "values.DEX.mod",
      "svg": "/static/initiative.svg",
      "visible_plus": true,
      "accent": "#5aaf72"
    }
  },
  "prof_bonus": {
    "id": "prof_bonus",
    "type": "DND_PROF_BONUS",
    "content": {
      "svg": "/static/prof-bonus.svg",
      "level_id": "lvl",
      "accent": "#b07bd4"
    }
  },
  "exhaustion": {
    "id": "exhaustion",
    "type": "DND_EXHAUSTION",
    "content": {}
  }
}
