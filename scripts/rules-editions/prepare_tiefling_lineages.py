"""Separate PHB 2024 tiefling heritage and size, with linked spell grants."""
import copy
import re
from content_common import key, ref
from species_details import HEIGHTS, paragraphs

LINEAGES = {
    'Наследие Бездны': ('яд', 4, ['Ядовитые брызги', 'Луч болезни', 'Удержание личности']),
    'Хтоническое наследие': ('некротическая энергия', 10, ['Леденящее прикосновение', 'Псевдожизнь', 'Луч слабости']),
    'Инфернальное наследие': ('огонь', 5, ['Огненный снаряд', 'Адское возмездие', 'Тьма']),
}
CHOICE_ONLY = {('Человек', 'Умелый'), ('Человек', 'Универсальность'),
               ('Эльф', 'Обострённые чувства'), ('Драконорождённый', 'Драконье происхождение')}


def build_tiefling_lineages(race, lineage, presence_id, spell_id=lambda name: ref(key('spell', name))):
    parts = re.split(r'<h3>(Наследие Бездны|Хтоническое наследие|Инфернальное наследие)</h3>', race['data']['description'])
    if len(parts) != 7:
        raise ValueError('Expected three distinct tiefling lore sections')
    lore = dict(zip(parts[1::2], parts[2::2]))
    records = []
    for name, (damage, damage_id, spells) in LINEAGES.items():
        subkey = key('subspecies', name)
        records.append({'key': subkey, 'name': name, 'typeId': 16,
                        'data': {'race': race['id'], 'description': lore[name], 'speed': race['data']['speed'],
                                 'creature_type': 'Гуманоид', 'rules_source': race['data']['rules_source'],
                                 'short_description': f'Сопротивление: {damage}. {spells[0]}; с 3-го уровня — {spells[1]}; с 5-го — {spells[2]}.'},
                        'automationStatus': 'partial', 'automationNote': 'Сопротивление и дарованные заклинания; размер выбирается отдельно.'})
        common = {'race_ids': [{'id': race['id']}], 'subrace_ids': [{'id': ref(subkey)}],
                  'level': 1, 'level_source': 'bound', 'rules_source': race['data']['rules_source']}
        records.append({'key': key('subspecies-feature', name+':сопротивление'), 'name': 'Сопротивление: '+damage, 'typeId': 3,
                        'data': {**common, 'desc': paragraphs(f'Вы получаете сопротивление урону: {damage}.'),
                                 'defenses': [{'kind': 'resistance', 'damage_type': damage_id}]}, 'automationStatus': 'full'})
        grants = [{'spell': spell_id(spell), 'level': level, 'ability_choice_key': 'casting_ability',
                   'ability_choice_source': presence_id, **({'slotless': True} if level > 1 else {})}
                  for level, spell in zip([1, 3, 5], spells)]
        desc = (f'На 1-м уровне вы знаете заговор «{spells[0]}». На 3-м уровне всегда подготовлено «{spells[1]}», '
                f'на 5-м — «{spells[2]}». Каждое из этих заклинаний 3-го и 5-го уровней персонажа можно сотворить '
                'без ячейки один раз за Долгий отдых или с тратой ячейки подходящего уровня. '
                'Заклинательная характеристика — та же, что выбрана для Потустороннего присутствия.')
        records.append({'key': key('subspecies-feature', name+':магия'), 'name': 'Магия: '+name.lower(), 'typeId': 3,
                        'data': {**common, 'desc': paragraphs(desc), 'granted_spells': grants, 'choice_only': True},
                        'automationStatus': 'partial', 'automationNote': 'Заклинания выдаются на уровнях 1, 3, 5 с выбранной характеристикой; бесплатные применения учитываются игроком.'})
    data = copy.deepcopy(race['data'])
    data['description'] = parts[0].replace(' Три варианта наследия описаны ниже.', '')
    data['variants'] = [{'value': size, 'label': size, 'size': size, 'size_description': note}
                        for size, note in HEIGHTS['Тифлинг'].items()]
    presence = {'choices': copy.deepcopy(lineage['data']['choices']),
                'granted_spells': [{'spell': spell_id('Чудотворство'), 'level': 1, 'ability_choice_key': 'casting_ability'}]}
    return records, data, presence
