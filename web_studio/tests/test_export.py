from lxml import etree
from odoo import Command
from odoo.tests.common import BaseCase, HttpCase
from odoo.addons.web_studio.controllers import export
from odoo.addons.web_studio.wizard.studio_export_wizard import _find_circular_dependencies
from odoo.addons.website.tools import MockRequest


class TestExport(HttpCase):
    def test_export_currency_field(self):
        base_currency_field = self.env["res.partner"]._fields.get("currency_id")
        if not base_currency_field or not (base_currency_field.type == "many2one" and base_currency_field.comodel_name == "res.currency"):
            self.env["ir.model.fields"].create({
                "state": "base",
                "name": "x_currency" if base_currency_field else "currency_id",
                "model_id": self.env["ir.model"]._get("res.partner").id,
                "ttype": "many2one",
                "relation": "res.currency"
            })

        IrModelFields = self.env["ir.model.fields"].with_context(studio=True)
        currency_field = IrModelFields.create({
            "name": "x_test_currency",
            "model_id": self.env["ir.model"]._get("res.partner").id,
            "ttype": "many2one",
            "relation": "res.currency"
        })
        monetary = IrModelFields.create({
            "name": "x_test_monetary",
            "model_id": self.env["ir.model"]._get("res.partner").id,
            "ttype": "monetary",
            "currency_field": currency_field.name,
        })

        studio_module = self.env["ir.module.module"].get_studio_module()
        data = self.env['ir.model.data'].search([
            ('studio', '=', True), ("model", "=", "ir.model.fields"), ("res_id", "in", (currency_field | monetary).ids)
        ])
        data = self.env["studio.export.wizard.data"].create(
            [{"model": d.model, "res_id": d.res_id, "studio": d.studio} for d in data]
        )
        wizard = self.env['studio.export.wizard'].create({
            "default_export_data": [Command.set(data.ids)],
            "additional_models": [],
        })
        export_info = wizard._get_export_info()
        content_iter = iter(export.generate_module(studio_module, export_info))

        file_name = content = None
        with MockRequest(self.env):
            while file_name != "data/ir_model_fields.xml":
                file_name, content = next(content_iter)

        arch_fields = etree.fromstring(content)
        records = arch_fields.findall("record")
        currency_field = records[0]
        self.assertEqual(currency_field.find("./field[@name='name']").text, "x_test_currency")
        self.assertEqual(currency_field.find("./field[@name='currency_field']"), None)

        monetary_field = records[1]
        self.assertEqual(monetary_field.find("./field[@name='name']").text, "x_test_monetary")
        self.assertEqual(monetary_field.find("./field[@name='currency_field']").text, "x_test_currency")

        monetary.currency_field = False
        export_info = wizard._get_export_info()
        content_iter = iter(export.generate_module(studio_module, export_info))

        file_name = content = None
        with MockRequest(self.env):
            while file_name != "data/ir_model_fields.xml":
                file_name, content = next(content_iter)

        arch_fields = etree.fromstring(content)
        records = arch_fields.findall("record")
        currency_field = records[0]
        self.assertEqual(currency_field.find("./field[@name='name']").text, "x_test_currency")
        self.assertEqual(currency_field.find("./field[@name='currency_field']"), None)

        monetary_field = records[1]
        self.assertEqual(monetary_field.find("./field[@name='name']").text, "x_test_monetary")
        # This assertion is correct technically: the python monetary field will fallback
        # on one of the hardcoded currency field names.
        # For this test though, on res.partner, the actual field will crash
        self.assertEqual(monetary_field.find("./field[@name='currency_field']"), None)


class TestCircularDependencies(BaseCase):
    def test_circular_dependencies(self):
        self.assertEqual(_find_circular_dependencies({}), [])
        self.assertEqual(_find_circular_dependencies({1: []}), [])
        self.assertEqual(_find_circular_dependencies({1: [1]}), [])
        self.assertEqual(_find_circular_dependencies({1: [2]}), [])
        self.assertEqual(_find_circular_dependencies({1: [2], 2: [3]}), [])
        self.assertEqual(_find_circular_dependencies({1: [2, 3], 2: [3], 3: [4]}), [])
        self.assertEqual(_find_circular_dependencies({1: [2], 2: [3], 3: [1]}), [[1, 2, 3, 1]])
        self.assertEqual(_find_circular_dependencies({1: [2, 3], 2: [3], 3: [1]}), [[1, 2, 3, 1]])
        self.assertEqual(_find_circular_dependencies({1: [2], 2: [3], 3: [4], 4: [1]}), [[1, 2, 3, 4, 1]])
        self.assertEqual(_find_circular_dependencies({1: [2], 2: [1], 3: [4], 4: [5], 5: [3]}), [[1, 2, 1], [3, 4, 5, 3]])
