"""Reviewed PHB 2024 species presentation, retaining the supplied rules text.

Exact feature headings prevent sentence-based heuristic splitting. Lineage
options stay inside their parent feature: they are alternatives, not grants.
"""
import copy
import html
import re

FEATURES = {
    'Аасимар': ['Небесное сопротивление', 'Тёмное зрение', 'Исцеляющие руки', 'Несущий свет', 'Небесное откровение'],
    'Гном': ['Тёмное зрение', 'Гномья хитрость', 'Гномья родословная'],
    'Голиаф': ['Великание происхождение', 'Большой размер', 'Мощное телосложение'],
    'Дварф': ['Тёмное зрение', 'Дварфийская устойчивость', 'Дварфийская крепость', 'Знание камня'],
    'Драконорождённый': ['Драконье происхождение', 'Оружие дыхания', 'Сопротивление урону', 'Тёмное зрение', 'Драконий полёт'],
    'Орк': ['Выброс адреналина', 'Тёмное зрение', 'Непоколебимая стойкость'],
    'Полурослик': ['Храбрый', 'Проворство полуросликов', 'Удача', 'Естественная скрытность'],
    'Тифлинг': ['Тёмное зрение', 'Наследие Исчадия', 'Потустороннее присутствие'],
    'Человек': ['Находчивый', 'Умелый', 'Универсальность'],
    'Эльф': ['Тёмное зрение', 'Эльфийская родословная', 'Фейское происхождение', 'Обострённые чувства', 'Транс'],
}
LATER_LEVELS = {'Небесное откровение': 3, 'Большой размер': 5, 'Драконий полёт': 5}
LINEAGE_FEATURE = {'Гном': 'Гномья родословная', 'Голиаф': 'Великание происхождение',
                   'Драконорождённый': 'Драконье происхождение', 'Тифлинг': 'Наследие Исчадия', 'Эльф': 'Эльфийская родословная'}
# Heights checked in the supplied PDF, printed pp. 186–197. The import had
# dropped the metadata block for the three species with adjacent tables.
HEIGHTS = {
    'Аасимар': {'Маленький': 'Рост в пределах 2–4 футов.', 'Средний': 'Рост в пределах 4–7 футов.'},
    'Гном': {'Маленький': 'Рост в пределах 3–4 футов.'},
    'Голиаф': {'Средний': 'Рост в пределах 7–8 футов.'},
    'Дварф': {'Средний': 'Рост в пределах 4–5 футов.'},
    'Драконорождённый': {'Средний': 'Рост в пределах 5–7 футов.'},
    'Орк': {'Средний': 'Рост в пределах 6–7 футов.'},
    'Полурослик': {'Маленький': 'Рост в пределах 2–3 футов.'},
    'Тифлинг': {'Маленький': 'Рост около 3–4 футов.', 'Средний': 'Рост около 4–7 футов.'},
    'Человек': {'Маленький': 'Рост в пределах 2–4 футов.', 'Средний': 'Рост в пределах 4–7 футов.'},
    'Эльф': {'Средний': 'Рост в пределах 5–6 футов.'},
}
VARIANT_BENEFITS = {
    'Лесной гном': ['Заговор «Малая иллюзия».', '«Разговор с животными» всегда подготовлен: без ячейки БВ раз за долгий отдых; можно тратить свои ячейки.'],
    'Скальный гном': ['Заговоры «Починка» и «Фокусы».', 'За 10 минут создаёте заводное устройство с эффектом «Фокусов». До трёх устройств, каждое работает 8 часов.'],
    'Облачный великан': ['Бонусным действием телепортируетесь до 30 футов в видимое свободное место.'],
    'Огненный великан': ['При попадании атакой добавляете 1к10 урона огнём.'],
    'Ледяной великан': ['При попадании добавляете 1к6 урона холодом и снижаете скорость цели на 10 футов до начала своего следующего хода.'],
    'Холмовой великан': ['При попадании атакой сбиваете с ног цель Большого размера или меньше.'],
    'Каменный великан': ['Реакцией уменьшаете полученный урон на 1к12 + модификатор Телосложения.'],
    'Штормовой великан': ['Получив урон от существа в пределах 60 футов, реакцией наносите ему 1к8 урона звуком.'],
    'Дроу': ['Тёмное зрение 120 футов и заговор «Пляшущие огоньки».', 'С 3-го уровня — «Огонь фей»; с 5-го — «Тьма».'],
    'Высший эльф': ['Заговор «Фокусы»: после долгого отдыха можно заменить другим заговором Волшебника.', 'С 3-го уровня — «Обнаружение магии»; с 5-го — «Туманный шаг».'],
    'Лесной эльф': ['Скорость 35 футов и заговор «Искусство друидов».', 'С 3-го уровня — «Скороход»; с 5-го — «Бесследное передвижение».'],
    'Наследие Бездны': ['Сопротивление яду и заговор «Ядовитые брызги».', 'С 3-го уровня — «Луч болезни»; с 5-го — «Удержание личности».'],
    'Хтоническое наследие': ['Сопротивление некротической энергии и заговор «Леденящее прикосновение».', 'С 3-го уровня — «Псевдожизнь»; с 5-го — «Луч слабости».'],
    'Инфернальное наследие': ['Сопротивление огню и заговор «Огненный снаряд».', 'С 3-го уровня — «Адское возмездие»; с 5-го — «Тьма».'],
}
DRAGON_DAMAGE = {'Чёрный': 'кислотой', 'Медный': 'кислотой', 'Синий': 'электричеством', 'Бронзовый': 'электричеством',
                 'Латунный': 'огнём', 'Золотой': 'огнём', 'Красный': 'огнём', 'Зелёный': 'ядом', 'Серебряный': 'холодом', 'Белый': 'холодом'}


def plain(value):
    value = re.sub(r'</(?:p|h3)>', '\n\n', value)
    value = re.sub(r'<br\s*/?>', ' ', value)
    return html.unescape(re.sub(r'<[^>]+>', '', value)).strip()


def paragraphs(value):
    return ''.join('<p>' + html.escape(re.sub(r'\s+', ' ', p).strip()) + '</p>'
                   for p in re.split(r'\n\s*\n', value) if p.strip())


def split_species(name, description):
    pieces = re.split(r'<h3>Особенности[^<]*</h3>', description)
    if len(pieces) != 2:
        raise ValueError('Missing species heading: ' + name)
    lore, rules = pieces
    table = ''
    if '<h3>Происхождение</h3>' in rules:
        rules, table = rules.split('<h3>Происхождение</h3>')
    rules = re.sub(r'<p>(?:эльфийские рода|Наследия исчадий|дракоНьи предки)</p>', '', rules)
    rules = re.sub(r'<p>Тип существа:.*?</p>', '', rules)
    text = plain(rules)
    intro = re.search(r'обладает следующими особенностями вида:\s*', text)
    if not intro:
        raise ValueError('Missing feature introduction: ' + name)
    text = text[intro.end():]
    positions = []
    for title in FEATURES[name]:
        pattern = r'(?:^|(?<=[.!?:])\s+)' + re.escape(title) + r'\.\s+'
        matches = list(re.finditer(pattern, text))
        if len(matches) != 1:
            raise ValueError(f'Ambiguous heading {name}: {title}: {len(matches)}')
        match = matches[0]
        positions.append((title, match.start(), match.end()))
    if [pos[1] for pos in positions] != sorted(pos[1] for pos in positions):
        raise ValueError('Feature order changed: ' + name)
    features = []
    for index, (title, start, end) in enumerate(positions):
        body = text[end:positions[index+1][1] if index+1 < len(positions) else len(text)].strip()
        if not body:
            raise ValueError('Empty feature ' + title)
        desc = paragraphs(body)
        if title == LINEAGE_FEATURE.get(name):
            desc += table
        features.append({'name': title, 'data': {'desc': desc, 'level': LATER_LEVELS.get(title, 1), 'level_source': 'bound'}})
    return lore, features


def enrich_species(name, original, features):
    data = copy.deepcopy(original)
    data['creature_type'] = 'Гуманоид'
    data['size_description'] = ' '.join(f'{size}: {note}' for size, note in HEIGHTS[name].items())
    lineage = next((feature['data']['desc'] for feature in features if feature['name'] == LINEAGE_FEATURE.get(name)), '')
    for variant in data.get('variants', []):
        size = variant.get('size', data['size'])
        variant['size_description'] = HEIGHTS[name][size]
        origin = variant['value'].split(':')[0]
        benefits = list(VARIANT_BENEFITS.get(origin, []))
        if name == 'Голиаф':
            benefits.append('Использований — БВ; восстанавливаются после долгого отдыха.')
        if name in ['Эльф', 'Тифлинг']:
            benefits.append('Полученные заклинания 3-го и 5-го уровней можно сотворять без ячейки раз за долгий отдых каждое или тратить свои ячейки.')
        if name == 'Драконорождённый':
            damage = DRAGON_DAMAGE[origin]
            benefits = [f'Оружие дыхания наносит урон {damage}.', f'Сопротивление урону {damage}.']
        if benefits:
            variant['benefits'] = [{'text': value} for value in benefits]
        if lineage:
            if name == 'Гном':
                text = plain(lineage)
                common = text.split('Выберите один из следующих вариантов:')[0].strip()
                start = text.index(origin + '.') + len(origin) + 1
                end = text.index('Скальный гном.') if origin == 'Лесной гном' else len(text)
                variant['description'] = paragraphs(common + '\n\n' + text[start:end].strip())
            else:
                variant['description'] = lineage
    return data


def feature_data(name, feature, aggregate):
    data = copy.deepcopy(feature['data'])
    data['race_ids'] = copy.deepcopy(aggregate['race_ids'])
    if feature['name'] == LINEAGE_FEATURE.get(name) and aggregate.get('choices'):
        data['choices'] = copy.deepcopy(aggregate['choices'])
    if name == 'Дварф' and feature['name'] == 'Дварфийская крепость':
        data['hp_bonuses'] = copy.deepcopy(aggregate['hp_bonuses'])
    return data
