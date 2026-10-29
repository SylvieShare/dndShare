"""Read the actual web effect layers, rather than maintaining a second hand-tuned palette."""
import re
from pathlib import Path


def render(root):
    die = (root / 'frontend/src/shared/ui/SystemDie.vue').read_text()
    orb = (root / 'frontend/src/features/items/components/SpellSlotSphere.vue').read_text()
    def rule(source, selector):
        match = re.search(re.escape(selector) + r'\s*\{([^}]+)\}', source)
        if not match: raise ValueError('Missing web visual layer: ' + selector)
        return dict(re.findall(r'([\w-]+):\s*([^;]+);', match.group(1)))
    def number(value): return float(re.match(r'[\d.]+', value)[0])
    def hex_color(value):
        value=value.strip().removeprefix('#')
        if len(value)==3: value=''.join(c*2 for c in value)
        if not re.fullmatch(r'[\da-fA-F]{6}',value): raise ValueError('Expected opaque web effect colour')
        return '0xFF' + value.upper()
    halo,body,liquid,shine,outline = [rule(die, '.system-die__'+key) for key in ['halo','body','liquid','shine','outline']]
    glass=rule(orb,'.ss-flask')
    declarations={
      'DieBody': ('Long',hex_color(body['fill'])), 'DieRim': ('Long',hex_color(outline['stroke'])),
      'DieHaloWidth': ('Float',str(number(halo['stroke-width']))+'f'),
      'DieHaloAlpha': ('Float',str(number(halo['opacity']))+'f'),
      'DieRimWidth': ('Float',str(number(outline['stroke-width']))+'f'),
      'DieLiquidAlpha': ('Float',str(number(liquid['opacity']))+'f'),
      'DieShineAlpha': ('Float',str(number(shine['opacity']))+'f'),
      'DieBlur': ('Float',re.search(r'feGaussianBlur stdDeviation="([\d.]+)"',die)[1]+'f'),
      'OrbBody': ('Long',hex_color(glass['background'])),
      'OrbRim': ('Long',hex_color(glass['border'].split()[-1])),
      'OrbRimWidth': ('Float',str(number(glass['border']))+'f'),
    }
    lines=['// Generated from SystemDie.vue and SpellSlotSphere.vue. Do not edit.',
      'package ru.dndshare.client.ui.designsystem','','internal object WebEffectSpec {']
    lines += [f'    const val {name}: {kind} = {value}' for name,(kind,value) in declarations.items()]
    return '\n'.join([*lines,'}',''])
