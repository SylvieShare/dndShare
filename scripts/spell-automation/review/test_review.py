import copy, unittest
from prepare import prepare
from patches import patch
from apply import preflight

def spell(id, data):
    return {'id':id,'name':'Тест','typeId':5,'data':data,'automationStatus':'none','automationNote':'Исходная оценка','requiresPlayerInteraction':False}
class ReviewTest(unittest.TestCase):
    def test_unknown_spell_keeps_review_and_data(self):
        item=spell(999999,{'description':'7к12 урона и все возможные бонусы'});before=copy.deepcopy(item)
        self.assertEqual(prepare([item]),([],[]));self.assertEqual(item,before)
    def test_secondary_poison_does_not_cancel_hit_damage(self):
        item=spell(604,{'damage':{'dices':[{'count':2,'dice_id':'d8','type':4}],'save_ability':'con','save_effect':'negate'},'duration':'Мгновенная'})
        plan,effects=prepare([item]);self.assertTrue(plan[0]['changes']['damage']['after']['save_manual'])
        self.assertEqual(effects[0]['duration'],{'kind':'rounds','value':1});self.assertFalse(effects[0]['data']['concentration'])
    def test_spell_attack_does_not_consume_weapon_only_disadvantage(self):
        _,effects=prepare([spell(503,{'duration':'Мгновенная'})]);rule=effects[0]['data']['derived_effects'][0]
        self.assertTrue(rule['weapon_attacks_only']);self.assertNotIn('end_on',effects[0]['data'])
    def test_claws_scale_attack_count_not_damage(self):
        data={};patch(492,data);self.assertEqual(data['damage']['addon_instances'],1);self.assertNotIn('addon',data['damage'])
    def test_preflight_preserves_unrelated_fields_but_rejects_changed_links(self):
        item=spell(461,{'duration':'1 минута','description':'Исходный текст'});plan,_=prepare([item]);item['data']['description']='Независимая правка'
        preflight(item,plan[0],set());item['data']['status_effects']=[{'key':'added','effect':{'id':100}}]
        with self.assertRaisesRegex(RuntimeError,'Effect links changed'):preflight(item,plan[0],set())
    def test_shared_damage_choice_never_becomes_full_by_formula_presence(self):
        self.assertEqual(prepare([spell(688,{'damage':{'dices':[{'count':3,'dice_id':'d8'}]}})]),([],[]))
if __name__=='__main__':unittest.main()
