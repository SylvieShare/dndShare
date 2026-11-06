import unittest

from catalogue_audit import audit


def field(key, kind, **options):
    return {"key": key, "type": kind, **options}


def item(id_, type_, **data):
    return {"id": id_, "typeId": type_, "name": str(id_), "data": data}


class CatalogueAuditTest(unittest.TestCase):
    def test_scopes_keys_typed_references_and_hidden_targets(self):
        schema = [
            field("choices", "object_array", fields=[field("key", "text")]),
            field("derived_effects", "object_array", fields=[
                field("kind", "select", options=[{"value": "roll_mode"}]), field("scopes", "text_array"),
                field("choice_key", "text"), field("skill_ids", "suggest_array", suggest_type_id=15),
            ]),
            field("items", "item_array", item_type=[1, 2]),
        ]
        source = item(1, 4, choices=[{"key": "training"}], items=[{"id": 2}, 3],
                      derived_effects=[dict(kind="roll_mode", scopes=["attack"], choice_key="training", skill_ids=[4])])
        snapshot = {"types": [{"id": 4, "fields": schema}, {"id": 12, "parentTypeId": 2, "fields": []}],
                    "items": [source, item(2, 12)], "referenced_items": [{**item(3, 1), "hidden": True}],
                    "suggests": {"15": [{"id": 4}]}}
        valid = audit(snapshot)
        self.assertEqual([], valid["issues"])
        self.assertEqual(1, valid["counts"]["references_to_hidden_items"])
        source["data"]["choices"] *= 2
        source["data"]["items"] = [77, 1]
        source["data"]["derived_effects"] = [dict(kind="unknown", scopes=["unknown"], choice_key="removed", skill_ids=[9])]
        problems = audit(snapshot)["issues"]
        self.assertEqual({"duplicate_rule_key", "unknown_option", "untested_derived_kind", "unknown_scope",
                          "missing_rule_key", "missing_item", "wrong_item_type", "missing_dictionary_entry"},
                         {issue["code"] for issue in problems})
        self.assertTrue(all(issue["item"] == 1 and issue["path"] for issue in problems))

    def test_cross_item_choice_and_binding_are_resolved_on_the_target(self):
        choice = field("choices", "object_array", fields=[field("key", "text")])
        defense = field("choice_defenses", "object_array", fields=[field("source_item_id", "int"), field("choice_key", "text")])
        effect = field("status_effects", "object_array", fields=[
            field("effect", "item", item_type=15),
            field("parameter_bindings", "object_array", fields=[field("key", "text")]),
        ])
        power = item(1, 4, choices=[{"key": "local"}], choice_defenses=[{"source_item_id": 2, "choice_key": "remote"}],
                     status_effects=[{"effect": 3, "parameter_bindings": [{"key": "misspelled"}]}])
        snap = {"types": [{"id": 4, "fields": [choice, defense, effect]}, {"id": 15, "fields": []}],
                "items": [power, item(2, 4, choices=[{"key": "remote"}]), item(3, 15)], "suggests": {}}
        self.assertEqual(["unused_effect_parameter"], [i["code"] for i in audit(snap)["issues"]])
        power["data"]["choice_defenses"][0]["choice_key"] = "local"
        self.assertIn("missing_rule_key", {i["code"] for i in audit(snap)["issues"]})
