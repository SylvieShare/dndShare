-- SVG icons for PHB racial traits, class features and feats.
-- The artwork is deliberately stored in svg_storage and assigned through item.icon_svg_id:
-- item.data remains rules-only JSON, while related class features may share one glyph.
CREATE TEMP TABLE feature_icon_seed (
    icon_key text PRIMARY KEY,
    svg      text NOT NULL
) ON COMMIT DROP;

INSERT INTO feature_icon_seed (icon_key, svg)
VALUES
        -- Racial traits: one recognisable glyph per PHB trait.
        ('item-race-infernal-resistance', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 5 5v6c0 5 3 9 7 11 4-2 7-6 7-11V5l-7-3Z"/><path d="M12 17c-3-2-2-4 0-6-1-2 0-4 2-5 0 3 3 4 2 7 0 3-2 4-4 4Z"/></svg>'),
        ('item-race-lucky', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12C5 12 4 4 9 3c3-1 4 3 3 9Zm0 0c7 0 8-8 3-9-3-1-4 3-3 9Zm0 0c-7 0-8 8-3 9 3 1 4-3 3-9Zm0 0c7 0 8 8 3 9-3 1-4-3-3-9Z"/><circle cx="12" cy="12" r="1.5"/></svg>'),
        ('item-race-stout', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 19 6-10 3 4 3-8 6 14H3Z"/><path d="M8 19c0-4 8-4 8 0M10 16v-3h4v3"/></svg>'),
        ('item-race-gnome-cunning', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9a4 4 0 0 1 7-3 4 4 0 0 1 1 7 4 4 0 0 1-4 5H9a4 4 0 0 1-1-8Z"/><path d="M10 9c2 0 3 1 3 3M8 14h8M11 18v3h3v-3"/></svg>'),
        ('item-race-dwarven-toughness', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3l1 1 1-1a4 4 0 0 1 7 3c0 7-8 12-8 12Z"/><path d="m8 13 3-3 2 2 3-3"/></svg>'),
        ('item-race-dwarven-resilience', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 5 5v6c0 5 3 9 7 11 4-2 7-6 7-11V5l-7-3Z"/><path d="M8 12h8M10 8h4M10 16h4"/></svg>'),
        ('item-race-language', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/></svg>'),
        ('item-race-drow-magic', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 15a8 8 0 1 1-8-11 6 6 0 0 0 8 11Z"/><path d="m17 3 .7 2.3L20 6l-2.3.7L17 9l-.7-2.3L14 6l2.3-.7L17 3Z"/></svg>'),
        ('item-race-infernal-legacy', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5C4 3 3 6 5 8M17 5c3-2 4 1 2 3M7 5c1 3 3 4 5 4s4-1 5-4"/><path d="M12 9v12M8 21h8M9 14h6"/></svg>'),
        ('item-race-wizard-cantrip', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 21 11-11 3 3L7 24l-3-3Z"/><path d="m17 2 .7 2.3L20 5l-2.3.7L17 8l-.7-2.3L14 5l2.3-.7L17 2ZM21 9v3M19.5 10.5h3"/></svg>'),
        ('item-race-stonecunning', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 17 4-10 8-3 4 9-6 7-10-3Z"/><path d="m8 7 4 5 4-8M12 12l2 8"/></svg>'),
        ('item-race-mask-wild', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M12 14C7 14 4 11 4 6c5 0 8 3 8 8Zm0-3c5 0 8-3 8-8-5 0-8 3-8 8Z"/><path d="M7 18c2-2 8-2 10 0"/></svg>'),
        ('item-race-tinker', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="15" r="4"/><path d="M9 9v2M9 19v2M3 15h2M13 15h2M5 11l1.5 1.5M11.5 17.5 13 19M15 3l6 6M14 8l5-5M13 9l2-1 1 2-6 6"/></svg>'),
        ('item-race-fey-ancestry', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M12 14C7 14 4 11 4 6c5 0 8 3 8 8Zm0-3c5 0 8-3 8-8-5 0-8 3-8 8Z"/><path d="M7 4c2-2 3-2 5-2M17 2c-2 1-3 2-3 4"/></svg>'),
        ('item-race-keen-senses', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M4 5l2 2M20 5l-2 2"/></svg>'),
        ('item-race-breath-weapon', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14c4-1 5-4 7-8 3 1 5 3 5 6 3 0 5 2 6 5-6 3-13 3-18-3Z"/><path d="M13 15c3-2 5-1 8 0M7 15h.01"/></svg>'),
        ('item-race-minor-illusion', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c5 2 11 2 16 0v10c-5 5-11 5-16 0V5Z"/><path d="M7 10c2 1 3 1 5 0m1 0c2 1 3 1 4 0M8 15c3-2 5-2 8 0"/></svg>'),
        ('item-race-natural-stealth', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M12 14C7 14 4 11 4 6c5 0 8 3 8 8Zm0-3c5 0 8-3 8-8-5 0-8 3-8 8Z"/><path d="M4 19c4-3 12-3 16 0"/></svg>'),
        ('item-race-halfling-nimble', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4 8 10l4 3-2 8M9 11l-5 4M12 13l5 2 3 4"/><circle cx="12" cy="3" r="2"/><path d="M3 20h5M16 21h5"/></svg>'),
        ('item-race-damage-resistance', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 5 5v6c0 5 3 9 7 11 4-2 7-6 7-11V5l-7-3Z"/><path d="m8 12 3 3 5-7"/></svg>'),
        ('item-race-darkvision', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path d="M11 10a3 3 0 0 0 3 4"/></svg>'),
        ('item-race-trance', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16a8 8 0 1 1-8-12 6 6 0 0 0 8 12Z"/><path d="M5 20h14M8 17l-2 3M16 17l2 3"/></svg>'),
        ('item-race-versatility', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2Z"/><path d="M4 21h16"/></svg>'),
        ('item-race-brave', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3l1 1 1-1a4 4 0 0 1 7 3c0 7-8 12-8 12Z"/><path d="M12 10v6M9 13h6"/></svg>'),
        ('item-race-sunlight', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2M4 20 20 4"/></svg>'),

        -- Feats: each PHB feat has its own glyph.
        ('item-feat-elemental-adept', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c4 5 6 8 6 12a6 6 0 0 1-12 0c0-3 2-6 5-9-1 4 3 5 1 9 3-1 4-5 0-12Z"/><path d="M4 21h16"/></svg>'),
        ('item-feat-actor', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4c5 2 11 2 16 0v10c-5 7-11 7-16 0V4Z"/><path d="M7 9h3M14 9h3M8 14c3 3 5 3 8 0"/></svg>'),
        ('item-feat-athlete', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="2"/><path d="m11 7-3 5 4 2 3 7M9 12l-5 4M12 14l5-3 3 2M4 21h5M16 21h5"/></svg>'),
        ('item-feat-alert', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15a8 8 0 0 1 16 0l2 3H2l2-3Z"/><path d="M9 21h6M12 2v3M4 6l2 2M20 6l-2 2"/></svg>'),
        ('item-feat-grappler', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v8l-2-2c-2-2-4 0-2 2l6 8c2 3 8 2 9-2l1-7c0-2-3-2-3 0V7c0-2-3-2-3 0V5c0-2-3-2-3 0V3c0-2-3-2-3 0Z"/></svg>'),
        ('item-feat-inspiring-leader', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6" r="3"/><path d="M6 20c0-5 2-8 6-8s6 3 6 8M3 9l3 2M21 9l-3 2M4 15H2M22 15h-2"/></svg>'),
        ('item-feat-durable', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3l1 1 1-1a4 4 0 0 1 7 3c0 7-8 12-8 12Z"/><path d="M8 13h2l2-4 2 7 2-3h2"/></svg>'),
        ('item-feat-defensive-duelist', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20 18 5M16 3l5 5M4 15l5 5M3 21l3-1M7 4l10 10"/></svg>'),
        ('item-feat-war-caster', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21 18 8M16 6l4 4M4 16l5 5"/><path d="m8 3 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3ZM18 15v6M15 18h6"/></svg>'),
        ('item-feat-skilled', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2Z"/><path d="m8 21 4-4 4 4"/></svg>'),
        ('item-feat-dungeon-delver', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V9a7 7 0 0 1 14 0v12H5Z"/><path d="M9 21v-7h6v7M12 3v4M3 12h4M17 12h4"/></svg>'),
        ('item-feat-mounted-combatant', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19c0-6 3-10 9-10l4-5 3 2-2 5c2 2 2 5 1 8M7 19v3M17 19v3M9 9 7 5M13 9l-1-5"/><circle cx="17" cy="7" r="1"/></svg>'),
        ('item-feat-tough', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 5 5v6c0 5 3 9 7 11 4-2 7-6 7-11V5l-7-3Z"/><path d="M8 9h8v6H8zM10 7h4M10 17h4"/></svg>'),
        ('item-feat-lightly-armored', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 3 4-3 4 5-3 13H7L4 8l4-5Z"/><path d="M8 3v8l4 3 4-3V3"/></svg>'),
        ('item-feat-linguist', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v12H9l-5 4V4Z"/><path d="M8 8h8M8 12h3M14 12h2"/></svg>'),
        ('item-feat-martial-adept', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 20 6-6M7 3l14 14-4 4L3 7l4-4ZM14 10l4-4M15 3l6 6"/></svg>'),
        ('item-feat-great-weapon', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 21 3-6L18 3l3 3L9 16l-4 5ZM15 4l5 5M4 15l5 5"/></svg>'),
        ('item-feat-polearm', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 22 17 4M15 2l6 1-2 6-4-7ZM4 18l4 3M3 22h5"/></svg>'),
        ('item-feat-weapon-master', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21 19 7M16 3l5 5M3 16l5 5M4 21l-1 1M7 3l14 14"/></svg>'),
        ('item-feat-dual-wielder', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m3 21 7-7M14 10l7-7M18 2l4 4M2 18l4 4M21 21l-7-7M10 10 3 3M2 6l4-4M18 22l4-4"/></svg>'),
        ('item-feat-medium-armor-master', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m7 3 5 3 5-3 4 5-4 13H7L3 8l4-5Z"/><path d="M8 7h8v9l-4 3-4-3V7Z"/></svg>'),
        ('item-feat-heavy-armor-master', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m7 2 5 4 5-4 4 6-4 14H7L3 8l4-6Z"/><path d="M8 7h8v11H8zM8 11h8M12 7v11"/></svg>'),
        ('item-feat-shield-master', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3 9 8 11 5-2 8-6 8-11V5l-8-3Z"/><path d="M12 6v12M7 11h10"/></svg>'),
        ('item-feat-sharpshooter', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>'),
        ('item-feat-mobile', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4 8 10l4 3-2 8M9 11l-5 4M12 13l5 2 3 4"/><circle cx="12" cy="3" r="2"/><path d="M3 20h5M16 21h5M2 7h5"/></svg>'),
        ('item-feat-observant', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path d="M18 18l4 4"/></svg>'),
        ('item-feat-charger', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h12M11 7l5 5-5 5M6 5 3 3M6 19l-3 2"/><path d="m18 4 3 4-3 4M18 12l3 4-3 4"/></svg>'),
        ('item-feat-keen-mind', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9a4 4 0 0 1 7-3 4 4 0 0 1 1 7 4 4 0 0 1-4 5H9a4 4 0 0 1-1-8Z"/><path d="M12 9v4l3 2M11 18v3h3v-3"/></svg>'),
        ('item-feat-magic-initiate', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 21 11-11 3 3L7 24l-3-3Z"/><path d="m17 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/></svg>'),
        ('item-feat-ritual-caster', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m12 5 2 5 5 .5-4 3.5 1.5 5-4.5-3-4.5 3L9 14l-4-3.5 5-.5 2-5Z"/></svg>'),
        ('item-feat-savage-attacker', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 21 3-6L18 3l3 3L9 16l-4 5Z"/><path d="m4 4 4 2M3 9h4M9 2v4"/></svg>'),
        ('item-feat-spell-sniper', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6M18 3l3 3"/></svg>'),
        ('item-feat-resilient', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 5 5v6c0 5 3 9 7 11 4-2 7-6 7-11V5l-7-3Z"/><path d="m8 12 3 3 5-7"/></svg>'),
        ('item-feat-sentinel', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 5 5v6c0 5 3 9 7 11 4-2 7-6 7-11V5l-7-3Z"/><path d="M12 6v12M8 9h8"/></svg>'),
        ('item-feat-tavern-brawler', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v8L6 9c-2-2-4 0-2 2l6 8c2 3 8 2 9-2l1-7c0-2-3-2-3 0V7c0-2-3-2-3 0V5c0-2-3-2-3 0V3c0-2-3-2-3 0Z"/><path d="M3 22h18"/></svg>'),
        ('item-feat-heavily-armored', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m7 2 5 4 5-4 4 6-4 14H7L3 8l4-6Z"/><path d="M8 7h8v11H8zM8 11h8M12 7v11M5 8h14"/></svg>'),
        ('item-feat-mage-slayer', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21 19 7M16 3l5 5M3 16l5 5"/><path d="m7 3 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3M3 22 22 3"/></svg>'),
        ('item-feat-lucky', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12C5 12 4 4 9 3c3-1 4 3 3 9Zm0 0c7 0 8-8 3-9-3-1-4 3-3 9Zm0 0c-7 0-8 8-3 9 3 1 4-3 3-9Zm0 0c7 0 8 8 3 9-3 1-4-3-3-9Z"/><circle cx="12" cy="12" r="1.5"/></svg>'),
        ('item-feat-moderately-armored', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m7 3 5 3 5-3 4 5-4 13H7L3 8l4-5Z"/><path d="M8 7h8v9l-4 3-4-3V7ZM4 10h4M16 10h4"/></svg>'),
        ('item-feat-crossbow-expert', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7c5 5 13 5 18 0M12 4v16M8 17l4 3 4-3M5 10l14 8M19 10 5 18"/></svg>'),

        -- Shared semantic class-feature set.
        ('item-class-feature', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 7 5-2 9-5 6-5-6-2-9 7-5Z"/><circle cx="12" cy="11" r="3"/></svg>'),
        ('item-class-rage', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c4 5 6 8 6 12a6 6 0 0 1-12 0c0-3 2-6 5-9-1 4 3 5 1 9 3-1 4-5 0-12Z"/></svg>'),
        ('item-class-attack', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21 19 7M16 3l5 5M3 16l5 5M4 21l-1 1"/></svg>'),
        ('item-class-defense', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 5 5v6c0 5 3 9 7 11 4-2 7-6 7-11V5l-7-3Z"/><path d="m8 12 3 3 5-7"/></svg>'),
        ('item-class-aura', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>'),
        ('item-class-healing', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3l1 1 1-1a4 4 0 0 1 7 3c0 7-8 12-8 12Z"/><path d="M12 10v6M9 13h6"/></svg>'),
        ('item-class-inspiration', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13M9 8l10-2"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>'),
        ('item-class-wild-shape', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="15" r="4"/><circle cx="5" cy="11" r="2"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="19" cy="11" r="2"/></svg>'),
        ('item-class-magic', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4 21 11-11 3 3L7 24l-3-3Z"/><path d="m17 2 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/></svg>'),
        ('item-class-artifice', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/></svg>'),
        ('item-class-alchemy', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2h6M10 2v7l-5 9c-1 2 0 4 3 4h8c3 0 4-2 3-4l-5-9V2"/><path d="M7 16h10M9 12h6"/></svg>'),
        ('item-class-storm', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m13 2-7 11h6l-1 9 7-12h-6l1-8Z"/></svg>'),
        ('item-class-movement', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 4 8 10l4 3-2 8M9 11l-5 4M12 13l5 2 3 4"/><circle cx="12" cy="3" r="2"/><path d="M3 20h5M16 21h5"/></svg>'),
        ('item-class-stealth', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2"/><path d="M3 21 21 3"/></svg>'),
        ('item-class-action', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h14M13 7l5 5-5 5M6 5 3 3M6 19l-3 2M19 4l2 2M19 20l2-2"/></svg>'),
        ('item-class-knowledge', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h6a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4V4ZM20 4h-4a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h4V4Z"/></svg>'),
        ('item-class-illusion', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c5 2 11 2 16 0v10c-5 5-11 5-16 0V5Z"/><path d="M7 10c2 1 3 1 5 0m1 0c2 1 3 1 4 0M8 15c3-2 5-2 8 0"/></svg>'),
        ('item-class-necromancy', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11a7 7 0 1 1 14 0c0 3-1 5-3 6v4H8v-4c-2-1-3-3-3-6Z"/><circle cx="9" cy="11" r="1.5"/><circle cx="15" cy="11" r="1.5"/><path d="m10 16 2-2 2 2M10 21v-3M14 21v-3"/></svg>'),
        ('item-class-summoning', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m12 5 2 5 5 .5-4 3.5 1.5 5-4.5-3-4.5 3L9 14l-4-3.5 5-.5 2-5Z"/></svg>'),
        ('item-class-transformation', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12C6 12 4 8 5 3c4 1 7 4 7 9Zm0 0c6 0 8-4 7-9-4 1-7 4-7 9Zm0 0c-5 1-7 5-5 9 4-1 5-4 5-9Zm0 0c5 1 7 5 5 9-4-1-5-4-5-9Z"/></svg>'),
        ('item-class-charm', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3l1 1 1-1a4 4 0 0 1 7 3c0 7-8 12-8 12Z"/><path d="M9 11c2-2 5-1 5 1s-2 3-4 2"/></svg>'),
        ('item-class-divination', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M4 5l2 2M20 5l-2 2"/></svg>'),
        ('item-class-nature', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M12 14C7 14 4 11 4 6c5 0 8 3 8 8Zm0-3c5 0 8-3 8-8-5 0-8 3-8 8Z"/></svg>'),
        ('item-class-monk', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v8L6 9c-2-2-4 0-2 2l6 8c2 3 8 2 9-2l1-7c0-2-3-2-3 0V7c0-2-3-2-3 0V5c0-2-3-2-3 0V3c0-2-3-2-3 0Z"/></svg>'),
        ('item-class-luck', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12C5 12 4 4 9 3c3-1 4 3 3 9Zm0 0c7 0 8-8 3-9-3-1-4 3-3 9Zm0 0c-7 0-8 8-3 9 3 1 4-3 3-9Zm0 0c7 0 8 8 3 9-3 1-4-3-3-9Z"/></svg>'),
        ('item-class-channel', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3 6 6 3-6 3-3 7-3-7-6-3 6-3 3-6Z"/><circle cx="12" cy="11" r="2"/></svg>'),
        ('item-class-companion', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="15" r="4"/><circle cx="5" cy="11" r="2"/><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="19" cy="11" r="2"/></svg>'),
        ('item-class-critical', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2Z"/><path d="m13 7-3 5h4l-3 5"/></svg>'),
        ('item-class-rest', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16a8 8 0 1 1-8-12 6 6 0 0 0 8 12Z"/><path d="M4 21h16"/></svg>'),
        ('item-class-language', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4V5Z"/><path d="M8 9h8M8 12h5"/></svg>'),
        ('item-class-skill', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2Z"/><path d="M4 22h16"/></svg>'),
        ('item-class-shadow', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19 16a8 8 0 1 1-8-12 6 6 0 0 0 8 12Z"/><path d="M4 20 20 4"/></svg>'),
        ('item-class-flight', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18C7 11 5 6 3 3c6 1 9 4 9 9 0-5 3-8 9-9-2 3-4 8-9 15Z"/><path d="M12 12v10"/></svg>'),
        ('item-class-mind', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9a4 4 0 0 1 7-3 4 4 0 0 1 1 7 4 4 0 0 1-4 5H9a4 4 0 0 1-1-8Z"/><path d="M10 9c2 0 3 1 3 3M8 14h8M11 18v3h3v-3"/></svg>'),
        ('item-class-ki', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a6 6 0 0 0 0 12 3 3 0 0 1 0 6M12 9h.01M12 15h.01"/></svg>'),
        ('item-class-thief', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m5 21 3-6L18 3l3 3L9 16l-4 5Z"/><path d="M3 8c5-3 13-3 18 0-5 3-13 3-18 0Z"/></svg>'),
        ('item-class-holy', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/></svg>'),
        ('item-class-target', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m12 12 8-8M16 4h4v4"/></svg>');

-- Exact artwork for the 25 racial traits and 40 PHB feats in the catalog.
DO $$
DECLARE
    target record;
    saved_svg_id int8;
BEGIN
    FOR target IN
        WITH item_icons(type_id, item_name, icon_key) AS (
            VALUES
        (3, 'Адское сопротивление', 'item-race-infernal-resistance'),
        (3, 'Везучий', 'item-race-lucky'),
        (3, 'Выносливость коренастых', 'item-race-stout'),
        (3, 'Гномья хитрость', 'item-race-gnome-cunning'),
        (3, 'Дварфская стойкость', 'item-race-dwarven-toughness'),
        (3, 'Дварфская устойчивость', 'item-race-dwarven-resilience'),
        (3, 'Дополнительный язык', 'item-race-language'),
        (3, 'Дроуская магия', 'item-race-drow-magic'),
        (3, 'Дьявольское наследие', 'item-race-infernal-legacy'),
        (3, 'Заговор волшебника', 'item-race-wizard-cantrip'),
        (3, 'Знание камня', 'item-race-stonecunning'),
        (3, 'Маскировка дикой местности', 'item-race-mask-wild'),
        (3, 'Мастеровой', 'item-race-tinker'),
        (3, 'Наследие фей', 'item-race-fey-ancestry'),
        (3, 'Обострённые чувства', 'item-race-keen-senses'),
        (3, 'Оружие дыхания', 'item-race-breath-weapon'),
        (3, 'Природная иллюзия', 'item-race-minor-illusion'),
        (3, 'Природная скрытность', 'item-race-natural-stealth'),
        (3, 'Проворство полуросликов', 'item-race-halfling-nimble'),
        (3, 'Сопротивление урону', 'item-race-damage-resistance'),
        (3, 'Тёмное зрение', 'item-race-darkvision'),
        (3, 'Транс', 'item-race-trance'),
        (3, 'Универсальность навыков', 'item-race-versatility'),
        (3, 'Храбрый', 'item-race-brave'),
        (3, 'Чувствительность к солнцу', 'item-race-sunlight'),
        (7, 'Адепт стихий', 'item-feat-elemental-adept'),
        (7, 'Актёр', 'item-feat-actor'),
        (7, 'Атлет', 'item-feat-athlete'),
        (7, 'Бдительность', 'item-feat-alert'),
        (7, 'Борец', 'item-feat-grappler'),
        (7, 'Вдохновляющий лидер', 'item-feat-inspiring-leader'),
        (7, 'Выносливый', 'item-feat-durable'),
        (7, 'Дуэлянт', 'item-feat-defensive-duelist'),
        (7, 'Заклинатель в бою', 'item-feat-war-caster'),
        (7, 'Знаток', 'item-feat-skilled'),
        (7, 'Исследователь подземелий', 'item-feat-dungeon-delver'),
        (7, 'Конный боец', 'item-feat-mounted-combatant'),
        (7, 'Крепкий', 'item-feat-tough'),
        (7, 'Легко бронированный', 'item-feat-lightly-armored'),
        (7, 'Лингвист', 'item-feat-linguist'),
        (7, 'Мастер боевых искусств', 'item-feat-martial-adept'),
        (7, 'Мастер большого оружия', 'item-feat-great-weapon'),
        (7, 'Мастер древкового оружия', 'item-feat-polearm'),
        (7, 'Мастер оружия', 'item-feat-weapon-master'),
        (7, 'Мастер парного оружия', 'item-feat-dual-wielder'),
        (7, 'Мастер средних доспехов', 'item-feat-medium-armor-master'),
        (7, 'Мастер тяжёлых доспехов', 'item-feat-heavy-armor-master'),
        (7, 'Мастер щита', 'item-feat-shield-master'),
        (7, 'Меткий стрелок', 'item-feat-sharpshooter'),
        (7, 'Мобильный', 'item-feat-mobile'),
        (7, 'Наблюдательный', 'item-feat-observant'),
        (7, 'Налётчик', 'item-feat-charger'),
        (7, 'Острый ум', 'item-feat-keen-mind'),
        (7, 'Посвящённый в магию', 'item-feat-magic-initiate'),
        (7, 'Ритуальный заклинатель', 'item-feat-ritual-caster'),
        (7, 'Свирепый атакующий', 'item-feat-savage-attacker'),
        (7, 'Снайпер заклинаний', 'item-feat-spell-sniper'),
        (7, 'Стойкий', 'item-feat-resilient'),
        (7, 'Страж', 'item-feat-sentinel'),
        (7, 'Трактирный буян', 'item-feat-tavern-brawler'),
        (7, 'Тяжело бронированный', 'item-feat-heavily-armored'),
        (7, 'Убийца магов', 'item-feat-mage-slayer'),
        (7, 'Удачливый', 'item-feat-lucky'),
        (7, 'Умеренно бронированный', 'item-feat-moderately-armored'),
                (7, 'Эксперт арбалета', 'item-feat-crossbow-expert')
        )
        SELECT i.id, defs.svg
        FROM item_icons mapping
        JOIN feature_icon_seed defs ON defs.icon_key = mapping.icon_key
        JOIN dndshare.item i
          ON i.type_id = mapping.type_id
         AND lower(btrim(i.name)) = lower(mapping.item_name)
        WHERE i.user_id IS NULL
          AND i.icon_svg_id IS NULL
          AND i.icon_image_id IS NULL
        ORDER BY i.id
    LOOP
        INSERT INTO dndshare.svg_storage (data)
        VALUES (target.svg)
        RETURNING id INTO saved_svg_id;

        UPDATE dndshare.item
        SET icon_svg_id = saved_svg_id
        WHERE id = target.id
          AND icon_svg_id IS NULL
          AND icon_image_id IS NULL;
    END LOOP;
END
$$;

-- Class abilities share semantic glyphs. Ordered rules keep closely related
-- features visually consistent even when the same feature occurs on two classes.
DO $$
DECLARE
    target record;
    saved_svg_id int8;
BEGIN
    FOR target IN
        WITH resolved AS (
            SELECT i.id,
           CASE
               WHEN lower(i.name) ~ 'алхим|эликсир|реагент|химическ' THEN 'item-class-alchemy'
               WHEN lower(i.name) ~ 'магическ.*предмет|предмет.*заклин|наполнение предмет|инструмент|изобрет|пушка|огнестрель' THEN 'item-class-artifice'
               WHEN lower(i.name) ~ 'ярост|неистов|безрассуд' THEN 'item-class-rage'
               WHEN lower(i.name) ~ 'вдохнов|песнь|острое словцо|контрочар' THEN 'item-class-inspiration'
               WHEN lower(i.name) ~ 'исцел|целител|лечение|наложение рук|сохранение жизни|целостность тела|второе дыхание' THEN 'item-class-healing'
               WHEN lower(i.name) ~ 'аура|сияние|нимб|корона света' THEN 'item-class-aura'
               WHEN lower(i.name) ~ 'друид|дик.*облик|облик звер|облики круга|облик стих|тысяча обликов' THEN 'item-class-wild-shape'
               WHEN lower(i.name) ~ 'зверин.*спутник|добыча охотника|дух тотема|искатель духов|странник духов|тотемн' THEN 'item-class-companion'
               WHEN lower(i.name) ~ 'скрыт|исчез|плащ тен|теневой|работа на втором этаже|проникнов|самозван|воровск|убийство|смертельн|плут|хитрое действие' THEN 'item-class-thief'
               WHEN lower(i.name) ~ 'защит|огражд|сопротив|стойк|несгиб|неуяз|невосприим|неулов|уклон|увёрт|скользк|уцелев|укрепл|оберега|смягчение|спокойствие|чистота|пустое тело' THEN 'item-class-defense'
               WHEN lower(i.name) ~ 'бур|молни|гром|стихийн|стихий|разрушительный гнев' THEN 'item-class-storm'
               WHEN lower(i.name) ~ 'дополнительная атака|мультиатака|боевой стиль|боевые искусства|боевая магия|боевое превосходство|направленный удар|божественный удар|мистический удар|первобытный удар|удар удачи|удары,|жрец войны|боевой дикий' THEN 'item-class-attack'
               WHEN lower(i.name) ~ 'критическ|жестокий крит' THEN 'item-class-critical'
               WHEN lower(i.name) ~ 'быстр|передвиж|падение|рывок|странств|побег|движение|крылья|полёт' THEN 'item-class-movement'
               WHEN lower(i.name) ~ 'драконьи крылья|ангел' THEN 'item-class-flight'
               WHEN lower(i.name) ~ 'иллюз|двойник|двоич|раздвоен' THEN 'item-class-illusion'
               WHEN lower(i.name) ~ 'нежит|некром|мрачная жатва|прислужник' THEN 'item-class-necromancy'
               WHEN lower(i.name) ~ 'призыв|вызов' THEN 'item-class-summoning'
               WHEN lower(i.name) ~ 'преобраз|превращ|облик|изменён' THEN 'item-class-transformation'
               WHEN lower(i.name) ~ 'очар|гипно|бред' THEN 'item-class-charm'
               WHEN lower(i.name) ~ 'прориц|знамение|видения прошлого|третий глаз|прочтение мыслей|познание веков|знай своего врага' THEN 'item-class-divination'
               WHEN lower(i.name) ~ 'природ|звер|земл|охотник|избранный враг|истребитель врагов' THEN 'item-class-nature'
               WHEN lower(i.name) ~ 'ци$|ладон|ошеломля|отражение снаряд|монах|безмятеж|совершенство' THEN 'item-class-ki'
               WHEN lower(i.name) ~ 'монах|боевые искусства' THEN 'item-class-monk'
               WHEN lower(i.name) ~ 'удач|хаос' THEN 'item-class-luck'
               WHEN lower(i.name) ~ 'божествен|священ|свет|благослов|канал|изгнание|отречение|кара|вмешательство|здоровье|чувство' THEN 'item-class-holy'
               WHEN lower(i.name) ~ 'язык|жаргон|друидический' THEN 'item-class-language'
               WHEN lower(i.name) ~ 'компетент|навык|мастер на все руки|выдающийся атлет|талант|ловкач|гениальност|тренировк' THEN 'item-class-skill'
               WHEN lower(i.name) ~ 'тень|тёмн|исчад|ад' THEN 'item-class-shadow'
               WHEN lower(i.name) ~ 'разум|мысл|чувств|чутьё|воспоминан' THEN 'item-class-mind'
               WHEN lower(i.name) ~ 'восстанов|отдых|вневременное|нестареющ' THEN 'item-class-rest'
               WHEN lower(i.name) ~ 'враг|охот|цель' THEN 'item-class-target'
               WHEN lower(i.name) ~ 'атака|удар|возмезд|оружие|бой|сражен|атаки' THEN 'item-class-attack'
               WHEN lower(i.name) ~ 'заклин|маг|аркан|чарод|пакта|метамаг|воззван|заговор|ритуал|фокусиров' THEN 'item-class-magic'
               ELSE 'item-class-feature'
           END AS icon_key
            FROM dndshare.item i
            WHERE i.type_id = 4
              AND i.user_id IS NULL
              AND i.icon_svg_id IS NULL
              AND i.icon_image_id IS NULL
        )
        SELECT resolved.id, defs.svg
        FROM resolved
        JOIN feature_icon_seed defs ON defs.icon_key = resolved.icon_key
        ORDER BY resolved.id
    LOOP
        INSERT INTO dndshare.svg_storage (data)
        VALUES (target.svg)
        RETURNING id INTO saved_svg_id;

        UPDATE dndshare.item
        SET icon_svg_id = saved_svg_id
        WHERE id = target.id
          AND icon_svg_id IS NULL
          AND icon_image_id IS NULL;
    END LOOP;
END
$$;

-- A future base trait/feat must still receive an icon even before its dedicated
-- artwork is added; known PHB rows above retain their exact assignments.
DO $$
DECLARE
    target record;
    saved_svg_id int8;
BEGIN
    FOR target IN
        WITH defaults(type_id, icon_key) AS (
            VALUES
                (3, 'item-race-versatility'),
                (7, 'item-class-feature')
        )
        SELECT i.id, defs.svg
        FROM defaults
        JOIN feature_icon_seed defs ON defs.icon_key = defaults.icon_key
        JOIN dndshare.item i ON i.type_id = defaults.type_id
        WHERE i.user_id IS NULL
          AND i.icon_svg_id IS NULL
          AND i.icon_image_id IS NULL
        ORDER BY i.id
    LOOP
        INSERT INTO dndshare.svg_storage (data)
        VALUES (target.svg)
        RETURNING id INTO saved_svg_id;

        UPDATE dndshare.item
        SET icon_svg_id = saved_svg_id
        WHERE id = target.id
          AND icon_svg_id IS NULL
          AND icon_image_id IS NULL;
    END LOOP;
END
$$;
