"""Separate outcomes and conditional damage, checked against TTG's 2014 entries."""
def row(count=0,sides=None,kind=None,bonus=0):
    r={}
    if sides:r.update(count=count,dice_id='d'+str(sides))
    if kind:r['type']=kind
    if bonus:r['bonus']=bonus
    return r

def effect(label,count=0,sides=None,damage_type=None,addon=0,*,kind='damage',bonus=0,addon_bonus=0,attack=False,step=1,levels=None,cap=None,scaling=None):
    r={'label':label,'kind':kind,'dices':[row(count,sides,damage_type,bonus)],'scaling':scaling or ('slot' if addon or addon_bonus else 'none')}
    if addon or addon_bonus:r['addon']=[row(addon,sides if addon else None,damage_type,addon_bonus)]
    if attack:r['range_attack']=True
    if step!=1:r['scaling_step']=step
    if levels:r['scaling_levels']=[{'level':v}for v in levels]
    if cap is not None:r['scaling_max_steps']=cap
    return r

FORMULAS={
474:[effect('Временные хиты',1,4,kind='effect')],
725:[effect('Частично замёрзшая цель',1,6,13),effect('Полностью подводная цель',2,6,13)],
737:[effect('Захват или сдавливание рукой',2,6,3)],
875:[effect('Начало хода в пустоте',2,6,13),effect('Конец хода, провал спасброска',2,6,8)],
994:[effect('Урон вихря до урона падения',3,8,3)],
1136:[effect('Первоначальный урон',8,6,5),effect('Горение в конце хода',4,6,5)],
1141:[effect('Успешный первый спасбросок',2,6,3),effect('Провал спасброска и повторный урон',4,6,3)],
1194:[effect('Дополнительный урон оружия',2,8,7),effect('Вспышка при окончании заклинания',4,8,7)],
1235:[effect('Первоначальный урон',5,10,11),effect('Пересечение границы иллюзии',10,10,11)],
1243:[effect('Урон рядом с вами',1,10,5),effect('Линия огня',4,8,5)],
1387:[effect('Раунд 1: гром',2,6,6),effect('Раунд 2: кислота',1,6,8),effect('Раунд 3: молния по одной цели',10,6,9),effect('Раунд 4: град',2,6,3),effect('Раунды 5–10: холод',1,6,13)],
1077:[effect('Дополнительный урон выбранного вида (раз в ход)',2,6)],
513:[effect('Цель с полными хитами',1,8,10,1,scaling='cantrip'),effect('Раненая цель',1,12,10,1,scaling='cantrip')],
575:[effect('Временные хиты и ответный урон холодом',kind='effect',bonus=5,addon_bonus=5)],
599:[effect('Попадание кинжалом',1,10,1,attack=True),effect('Взрыв при провале спасброска',2,6,13,1)],
658:[effect('Временные хиты',1,4,kind='effect',bonus=4,addon_bonus=5)],
665:[effect('Сумма хитов ослепляемых существ',6,10,addon=2,kind='effect')],
686:[effect('Сумма хитов усыпляемых существ',5,8,addon=2,kind='effect')],
687:[effect('Урон при движении быстрее половины скорости',2,6,3,2)],
706:[effect('Попадание зерном',4,4,5,1,attack=True),effect('Последующий взрыв',3,4,5,1)],
719:[effect('Дополнительный урон атаки',1,6,6,1)],
755:[effect('Попадание стрелой',4,4,8,1,attack=True),effect('Урон в конце следующего хода цели',2,4,8,1)],
788:[effect('Прибавка к текущим и максимальным хитам',kind='effect',bonus=5,addon_bonus=5)],
820:[effect('Порог хитов для усыпления',9,8,addon=3,kind='effect')],
824:[effect('Кости урона клинка (до модификатора оружия)',2,8,11,1,levels=[3,5,7])],
839:[effect('Урон в начале хода оглохшей цели',2,8,6,1)],
911:[effect('Первый урон; далее добавляйте 1к6 за повтор',1,6,5,1)],
915:[effect('Урон при движении быстрее половины скорости',4,6,3)],
917:[effect('Попадание молниевой стрелой',4,8,9,1,attack=True),effect('Вторичный взрыв',2,8,9,1)],
919:[effect('Временные хиты',kind='effect',bonus=5,addon_bonus=5)],
984:[effect('Дополнительный урон оружия',1,4,addon=1,levels=[5,7])],
1011:[effect('Первоначальный урон',5,8,12,1),effect('Кровотечение в конце хода',2,6,10)],
1028:[effect('Первоначальный урон',10,4,8,2),effect('Дополнительный урон в конце хода',5,4,8)],
1090:[effect('Дробящий урон сферы',2,6,3,1),effect('Попадание молнией',4,6,9,1,attack=True)],
1092:[effect('Урон сверх потраченных костей хитов',4,8,10,1,attack=True)],
1123:[effect('Сжатый кулак',4,8,12,2,attack=True),effect('Сжимающая длань',2,6,3,2)],
1127:[effect('Урон дыхания выбранного дракона',6,6,addon=2),effect('Перезарядка дыхания на 5–6',1,6,kind='effect')],
1129:[effect('Урон цели, выбравшей встречу со зверями',7,8,11,2)],
1138:[effect('Урон внутри дождя',6,6,8,2,step=2),effect('Урон после выхода из дождя',3,6,8,1,step=2)],
1159:[effect('При провале спасброска и повторное действие',4,8,10,1),effect('При успешном спасброске',2,8,10,1)],
1232:[effect('Появление стены',10,6,13,2),effect('Прохождение через холодный воздух',5,6,13,1)],
1237:[effect('Урон броска до падения и деления между целями',6,10,3,1)],
1278:[effect('Появление стены',7,8,1,1),effect('Прохождение через стену',7,8,2,1)],
1388:[effect('Урон воронки',10,6,5),effect('Урон остывающего пепла',1,6,5)],
}
FORMULAS[474][0]['add_mod']=True
FORMULAS[915][0].update(scaling='slot',addon=[row(1,8,3)])
FORMULAS[1123][1]['add_mod']=True

ATTACKS=[599,687,706,755,847,915,1090,1092,1123,1237]

def correct_effects(item):
    id=item['id'];data=item['data']
    if id in FORMULAS:data['rolls']=FORMULAS[id]
    if id in ATTACKS:data.setdefault('damage',{})['range_attack']=True
    if id==699:data['damage']={'range_attack':True,'dices':[row(3,8)],'scaling':'slot','instances':1,'addon_instances':1}
    if id==912:data['damage']={'dices':[row(2,6,5)],'scaling':'slot','instances':6,'addon_instances':2,'save_ability':'dex','save_effect':'half'}
    if id==675:data['damage']={'range_attack':True,'dices':[row(2,8),row(1,6)],'addon':[row(1,6)],'scaling':'slot'}
    if id==794:data['heal']={'dices':[row(1,8,bonus=5)],'addon':[row(1,8,bonus=5)],'scaling':'slot','scaling_levels':[{'level':v}for v in[4,6,8]]}
    if id==1315:data['damage']={'dices':[row(6,6,5),row(6,6,13)],'addon':[row(1,6,5),row(1,6,13)],'scaling':'slot','save_ability':'dex','save_effect':'half'}
