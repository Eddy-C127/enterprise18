import ast
import base64
from itertools import starmap
from lxml import etree as ET

from odoo import Command, SUPERUSER_ID
from odoo.addons.web_studio.controllers.export import _get_xmlid, generate_module
from odoo.addons.website.tools import MockRequest
from odoo.osv import expression
from odoo.tests.common import TransactionCase, tagged

# ---------------------------------- HELPERS ----------------------------------
XMLPARSER = ET.XMLParser(remove_blank_text=True, strip_cdata=False, resolve_entities=False)
IR_MODEL_INFO_FIELD = """<field name="info"><![CDATA[ Main super-class for regular database-persisted Odoo models.

    Odoo models are created by inheriting from this class::

        class user(Model):
            ...

    The system will later instantiate the class once per database (on
    which the class' module is installed).
    ]]></field>"""


def nodes_equal(n1, n2):
    if n1.tag != n2.tag:
        return False
    if n1.text != n2.text:
        return False
    if n1.tail != n2.tail:
        return False
    if n1.attrib != n2.attrib:
        return False
    if len(n1) != len(n2):
        return False
    if n1.tag == "field":
        # compare a tostring version, to check if CDATA sections are preserved
        n1_str = ET.tostring(n1)
        n2_str = ET.tostring(n2)
        if n1_str != n2_str:
            return False
    if n1.tag == "record":
        # n1 and n2 children order doesn't matter, sort them by tagname, attrib['name']
        n1 = sorted(n1, key=lambda n: (n.tag, n.attrib.get("name")))
        n2 = sorted(n2, key=lambda n: (n.tag, n.attrib.get("name")))
    return all(starmap(nodes_equal, zip(n1, n2)))


class StudioExportCase(TransactionCase):
    def setUp(self):
        super().setUp()
        self._customizations = []
        self._additional_models = self.env["studio.export.model"]
        self.TestModel = self.env["test.studio_export.model1"]
        self.TestModel2 = self.env["test.studio_export.model2"]
        self.TestModel3 = self.env["test.studio_export.model3"]

    def create_customization(self, _model, **kwargs):
        Model = self.env[_model].with_context(studio=True)
        custo = Model.create(kwargs)
        self._customizations.append(custo)
        return custo

    def create_export_model(self, _model, **kwargs):
        IrModel = self.env["ir.model"]
        vals = {"model_id": IrModel._get_id(_model)}
        vals.update(kwargs)
        export_model = self.env["studio.export.model"].create(vals)
        self._additional_models |= export_model
        self.addCleanup(export_model.unlink)
        return export_model

    def get_xmlid(self, record):
        if self._current_wizard:
            all_data = self._current_wizard.default_export_data | self._current_wizard.additional_export_data
            record_data = all_data.filtered(lambda r: r.res_id == record.id and r.model == record._name)
            return _get_xmlid(record, record_data)
        return _get_xmlid(record)

    def studio_export(self):
        # Get all customization data
        custo_domains = [
            [("model", "=", custo._name), ("res_id", "=", custo.id)]
            for custo in self._customizations
        ]
        domain = expression.OR(custo_domains)
        domain = expression.AND([domain, [("studio", "=", True)]])
        custo_data = self.env["ir.model.data"].search(domain)
        custo_data = self.env["studio.export.wizard.data"].create(
            [
                {"model": d.model, "res_id": d.res_id, "studio": d.studio}
                for d in custo_data
            ]
        )

        studio_module = self.env["ir.module.module"].get_studio_module()
        self._current_wizard = self.env["studio.export.wizard"].create(
            {
                "default_export_data": [Command.set(custo_data.ids)],
                "additional_models": [Command.set(self._additional_models.ids)],
            }
        )
        export_info = self._current_wizard._get_export_info()
        content = generate_module(studio_module, export_info)
        return StudioExportAssertor(export_case=self, content=content)


class StudioExportAssertor:

    def __init__(self, export_case, content) -> None:
        self.export_case = export_case
        self.exported_cache = {}
        self.content_iter = iter(content)

    def get_exported(self, name=None):
        """If name not found (or None) will iterate on all generated files"""
        with MockRequest(self.export_case.env):
            while name not in self.exported_cache:
                try:
                    path, content = next(self.content_iter)
                except StopIteration:
                    break
                if path.endswith(".xml"):
                    self.exported_cache[path] = ET.fromstring(content, parser=XMLPARSER)
                elif path.endswith("__manifest__.py"):
                    self.exported_cache[path] = ast.literal_eval(content.decode("utf-8"))
                else:
                    self.exported_cache[path] = content

        return self.exported_cache[name] if name else self.exported_cache

    def assertFileContains(self, path, content):
        file = self.get_exported(path)
        self.export_case.assertEqual(file, content)

    def assertFileList(self, *filenames):
        """You can omit __init__.py and __manifest__.py"""
        filenames += ("__init__.py", "__manifest__.py")
        exported = self.get_exported()
        self.export_case.assertEqual(set(exported.keys()), set(filenames))

    def assertManifest(self, **expected):
        exported = self.get_exported("__manifest__.py")
        for key in expected:
            if key == "depends":
                for d in expected["depends"]:
                    self.export_case.assertIn(d, exported["depends"])
            else:
                self.export_case.assertEqual(exported[key], expected[key])

    def assertRecords(self, path, *record_strings):
        root = self.get_exported(path)
        record_nodes = [
            ET.fromstring(record, parser=XMLPARSER) for record in record_strings
        ]

        actual = len(root.findall("./record"))
        self.export_case.assertEqual(actual, len(record_nodes), msg=f"Wrong records count, expected {len(record_nodes)} but got {actual}")

        for r_node in record_nodes:
            exported_record = root.find(
                f"./record[@id='{r_node.attrib['id']}']"
            )
            are_equal = nodes_equal(r_node, exported_record)
            message = "Both records are equal"
            if not are_equal:
                tostring_opts = {"encoding": "unicode", "pretty_print": True}
                expected = ET.tostring(r_node, **tostring_opts)
                actual = ET.tostring(exported_record, **tostring_opts)
                message = "\nExpected:\n%s\nActual:\n%s" % (expected, actual)
            self.export_case.assertTrue(are_equal, message)

    def assertXML(self, path, expected):
        root = self.get_exported(path)
        # parse expected then compare with nodes_equal
        expected = ET.fromstring(expected, parser=XMLPARSER)
        are_equal = nodes_equal(root, expected)
        message = "Both XMLs are equal"
        if not are_equal:
            tostring_opts = {"encoding": "unicode", "pretty_print": True}
            expected = ET.tostring(expected, **tostring_opts)
            actual = ET.tostring(root, **tostring_opts)
            message = "\nExpected:\n%s\nActual:\n%s" % (expected, actual)
        self.export_case.assertTrue(are_equal, message)


# ----------------------------------- TESTS -----------------------------------
@tagged("-at_install", "post_install")
class TestStudioExports(StudioExportCase):
    def test_export_customizations(self):
        custom_model = self.create_customization(
            "ir.model", name="Furnace Types", model="x_furnace_types"
        )
        custom_field = self.create_customization(
            "ir.model.fields",
            name="x_studio_max_temp",
            complete_name="Max temperature",
            ttype="integer",
            model_id=custom_model.id,
        )
        custom_view = self.create_customization(
            "ir.ui.view",
            name="Kanban view for x_furnace_types",
            model="x_furnace_types",
            type="kanban",
            arch="""
                <kanban>
                    <templates>
                        <t t-name="kanban-box">
                            <div>
                                <field name="x_studio_max_temp" />
                            </div>
                        </t>
                    </templates>
                </kanban>
            """,
        )
        custom_action = self.create_customization(
            "ir.actions.act_window",
            name="Furnaces",
            res_model="x_furnace_types",
            view_mode="tree,form,kanban",
            help="<p>This is your new action.</p>",
        )
        custom_menu_1 = self.create_customization(
            "ir.ui.menu",
            name="My Furnaces",
        )
        custom_menu_2 = self.create_customization(
            "ir.ui.menu",
            name="Furnaces Types",
            parent_id=custom_menu_1.id,
            action=f"ir.actions.act_window,{custom_action.id}",
        )

        # Create a record to show that it is not exported
        # (appears neither in manifest nor in filelist)
        self.env[custom_model.model].create(
            {"x_name": "Austenitization", "x_studio_max_temp": 1200}
        )

        export = self.studio_export()
        export.assertManifest(
            data=[
                "data/ir_model.xml",
                "data/ir_model_fields.xml",
                "data/ir_ui_view.xml",
                "data/ir_actions_act_window.xml",
                "data/ir_ui_menu.xml",
            ],
            depends=["web_studio"],
        )
        export.assertFileList(
            "data/ir_model.xml",
            "data/ir_model_fields.xml",
            "data/ir_ui_view.xml",
            "data/ir_actions_act_window.xml",
            "data/ir_ui_menu.xml",
        )
        export.assertRecords(
            "data/ir_model.xml",
            f"""<record id="{self.get_xmlid(custom_model)}" model="ir.model" context="{{'studio': True}}">
                {IR_MODEL_INFO_FIELD}
                <field name="model">x_furnace_types</field>
                <field name="name">Furnace Types</field>
            </record>""",
        )
        export.assertRecords(
            "data/ir_model_fields.xml",
            f"""<record id="{self.get_xmlid(custom_field)}" model="ir.model.fields" context="{{'studio': True}}">
                <field name="complete_name">Max temperature</field>
                <field name="ttype">integer</field>
                <field name="copied" eval="True"/>
                <field name="field_description">X Studio Max Temp</field>
                <field name="model">x_furnace_types</field>
                <field name="model_id" ref="{self.get_xmlid(custom_model)}"/>
                <field name="name">x_studio_max_temp</field>
                <field name="on_delete" eval="False"/>
            </record>""",
        )
        export.assertRecords(
            "data/ir_ui_view.xml",
            f"""<record id="{self.get_xmlid(custom_view)}" model="ir.ui.view" context="{{'studio': True}}">
                <field name="arch" type="xml">
                        <kanban>
                            <templates>
                                <t t-name="kanban-box">
                                    <div>
                                        <field name="x_studio_max_temp" />
                                    </div>
                                </t>
                            </templates>
                        </kanban>
                </field>
                <field name="model">x_furnace_types</field>
                <field name="name">Kanban view for x_furnace_types</field>
                <field name="type">kanban</field>
            </record>""",
        )
        export.assertRecords(
            "data/ir_actions_act_window.xml",
            f"""<record id="{self.get_xmlid(custom_action)}" model="ir.actions.act_window" context="{{'studio': True}}">
                <field name="help"><![CDATA[<p>This is your new action.</p>]]></field>
                <field name="name">Furnaces</field>
                <field name="res_model">x_furnace_types</field>
                <field name="view_mode">tree,form,kanban</field>
            </record>""",
        )
        export.assertRecords(
            "data/ir_ui_menu.xml",
            f"""<record id="{self.get_xmlid(custom_menu_1)}" model="ir.ui.menu" context="{{'studio': True}}">
                <field name="name">My Furnaces</field>
            </record>""",
            f"""<record id="{self.get_xmlid(custom_menu_2)}" model="ir.ui.menu" context="{{'studio': True}}">
                <field name="action" ref="{self.get_xmlid(custom_action)}" />
                <field name="name">Furnaces Types</field>
                <field name="parent_id" ref="{self.get_xmlid(custom_menu_1)}" />
            </record>""",
        )

    def test_export_customizations_with_export_model(self):
        custom_model = self.create_customization(
            "ir.model", name="Furnace Types", model="x_furnace_types"
        )
        self.create_customization(
            "ir.model.fields",
            name="x_studio_max_temp",
            complete_name="Max temperature",
            ttype="integer",
            model_id=custom_model.id,
        )
        CustomModel = self.env[custom_model.model]
        furnace_type = CustomModel.create(
            {"x_name": "Austenitization", "x_studio_max_temp": 1200}
        )

        # Without export model, the custom model data are not exported
        export = self.studio_export()
        export.assertFileList("data/ir_model.xml", "data/ir_model_fields.xml")

        # With the export model, the custom model data is exported
        self.create_export_model(CustomModel._name)
        export = self.studio_export()
        export.assertFileList(
            "data/ir_model.xml",
            "data/ir_model_fields.xml",
            "data/x_furnace_types.xml",
        )
        export.assertRecords(
            "data/x_furnace_types.xml",
            f"""<record id="{self.get_xmlid(furnace_type)}" model="x_furnace_types">
                <field name="x_studio_max_temp">1200</field>
                <field name="x_name">Austenitization</field>
            </record>""",
        )

    def test_simple_export_model(self):
        export_model = self.create_export_model(self.TestModel._name)

        # Without record, the export_model has no effect
        export = self.studio_export()
        export.assertFileList()

        # Simple case
        some_record = self.TestModel.create({"name": "Some record"})
        export = self.studio_export()
        export.assertFileList("data/test_studio_export_model1.xml")
        export.assertXML("data/test_studio_export_model1.xml", f"""
            <odoo>
                <record id="{self.get_xmlid(some_record)}" model="test.studio_export.model1">
                    <field name="name">Some record</field>
                </record>
            </odoo>
        """)

        # With no_update mode
        export_model.no_update = True
        export = self.studio_export()
        export.assertFileList("data/test_studio_export_model1.xml")
        export.assertXML("data/test_studio_export_model1.xml", f"""
            <odoo noupdate="1">
                <record id="{self.get_xmlid(some_record)}" model="test.studio_export.model1">
                    <field name="name">Some record</field>
                </record>
            </odoo>
        """)

        # With is_demo_data mode, without no_update
        export_model.no_update = False
        export_model.is_demo_data = True
        export = self.studio_export()
        export.assertFileList("demo/test_studio_export_model1.xml")
        export.assertXML("demo/test_studio_export_model1.xml", f"""
            <odoo>
                <record id="{self.get_xmlid(some_record)}" model="test.studio_export.model1">
                    <field name="name">Some record</field>
                </record>
            </odoo>
        """)

        # With is_demo_data mode, with no_update
        export_model.no_update = True
        export_model.is_demo_data = True
        export = self.studio_export()
        export.assertFileList("demo/test_studio_export_model1.xml")
        export.assertXML("demo/test_studio_export_model1.xml", f"""
            <odoo noupdate="1">
                <record id="{self.get_xmlid(some_record)}" model="test.studio_export.model1">
                    <field name="name">Some record</field>
                </record>
            </odoo>
        """)

    def test_export_model_with_demo_data(self):
        some_record = self.TestModel.create({"name": "Some record"})
        other_record = self.TestModel.create({"name": "Some other record"})
        self.create_export_model(self.TestModel._name, is_demo_data=True)
        export = self.studio_export()
        export.assertFileList("demo/test_studio_export_model1.xml")
        export.assertRecords(
            "demo/test_studio_export_model1.xml",
            f"""<record id="{self.get_xmlid(some_record)}" model="test.studio_export.model1">
                <field name="name">Some record</field>
            </record>""",
            f"""<record id="{self.get_xmlid(other_record)}" model="test.studio_export.model1">
                <field name="name">Some other record</field>
            </record>""",
        )

    def test_export_model_with_binary_field(self):
        some_record = self.TestModel.create(
            {
                "name": "Some record",
                "binary_data": base64.b64encode(b"My binary attachment"),
            }
        )
        export_model = self.create_export_model(self.TestModel._name)

        # Without include_attachment
        export = self.studio_export()
        export.assertFileList(
            "data/test_studio_export_model1.xml",
            f"static/src/binary/test_studio_export_model1/{some_record.id}-binary_data",
        )
        export.assertRecords(
            "data/test_studio_export_model1.xml",
            f"""<record id="{self.get_xmlid(some_record)}" model="test.studio_export.model1">
                <field name="name">Some record</field>
                <field name="binary_data" type="base64" file="studio_customization/static/src/binary/test_studio_export_model1/{some_record.id}-binary_data"/>
            </record>""",
        )

        # With include_attachment we have the same export result
        export_model.include_attachment = True
        export = self.studio_export()
        export.assertFileList(
            "data/test_studio_export_model1.xml",
            f"static/src/binary/test_studio_export_model1/{some_record.id}-binary_data",
        )
        export.assertRecords(
            "data/test_studio_export_model1.xml",
            f"""<record id="{self.get_xmlid(some_record)}" model="test.studio_export.model1">
                <field name="name">Some record</field>
                <field name="binary_data" type="base64" file="studio_customization/static/src/binary/test_studio_export_model1/{some_record.id}-binary_data"/>
            </record>""",
        )

    def test_export_model_with_many2one_attachment(self):
        some_record = self.TestModel.create({"name": "Some record"})
        attachment = self.env["ir.attachment"].create(
            {
                "name": "Some attachment",
                "datas": base64.b64encode(b"My attachment"),
                "res_model": self.TestModel._name,
                "res_id": some_record.id,
                "res_field": "attachment_id",
            }
        )
        some_record.attachment_id = attachment
        self.create_export_model(self.TestModel._name, include_attachment=True)
        export = self.studio_export()
        export.assertFileList(
            "data/test_studio_export_model1.xml",
            "data/ir_attachment_pre.xml",
            f"static/src/binary/ir_attachment/{attachment.id}-Someattachment",
        )
        export.assertManifest(
            depends=["test_web_studio"],
            data=["data/ir_attachment_pre.xml", "data/test_studio_export_model1.xml"],
        )
        export.assertRecords(
            "data/ir_attachment_pre.xml",
            f"""<record id="{self.get_xmlid(attachment)}" model="ir.attachment">
                <field name="name">Some attachment</field>
                <field name="datas" type="base64" file="studio_customization/static/src/binary/ir_attachment/{attachment.id}-Someattachment"/>
            </record>""",
        )
        export.assertRecords(
            "data/test_studio_export_model1.xml",
            f"""<record id="{self.get_xmlid(some_record)}" model="test.studio_export.model1">
                <field name="name">Some record</field>
                <field name="attachment_id" ref="{self.get_xmlid(attachment)}"/>
            </record>""",
        )

    def test_export_model_with_one2many_attachment(self):
        some_record = self.TestModel.create({"name": "Some record"})
        attachment1 = self.env["ir.attachment"].create(
            {
                "name": "Some attachment",
                "datas": base64.b64encode(b"My attachment"),
                "res_model": self.TestModel._name,
                "res_id": some_record.id,
                "res_field": "attachment_ids",
            }
        )
        attachment2 = self.env["ir.attachment"].create(
            {
                "name": "Another attachment",
                "datas": base64.b64encode(b"My second attachment"),
                "res_model": self.TestModel._name,
                "res_id": some_record.id,
                "res_field": "attachment_ids",
            }
        )
        some_record.attachment_ids = [Command.set([attachment1.id, attachment2.id])]
        self.create_export_model(self.TestModel._name, include_attachment=True)
        export = self.studio_export()
        export.assertFileList(
            "data/test_studio_export_model1.xml",
            "data/ir_attachment_post.xml",
            f"static/src/binary/ir_attachment/{attachment1.id}-Someattachment",
            f"static/src/binary/ir_attachment/{attachment2.id}-Anotherattachment",
        )
        export.assertManifest(
            depends=["test_web_studio"],
            data=["data/test_studio_export_model1.xml", "data/ir_attachment_post.xml"],
        )
        export.assertRecords(
            "data/ir_attachment_post.xml",
            f"""<record id="{self.get_xmlid(attachment1)}" model="ir.attachment">
                <field name="name">Some attachment</field>
                <field name="datas" type="base64" file="studio_customization/static/src/binary/ir_attachment/{attachment1.id}-Someattachment" />
                <field name="res_id" ref="{self.get_xmlid(some_record)}" />
                <field name="res_model">test.studio_export.model1</field>
                <field name="res_field">attachment_ids</field>
            </record>""",
            f"""<record id="{self.get_xmlid(attachment2)}" model="ir.attachment">
                <field name="name">Another attachment</field>
                <field name="datas" type="base64" file="studio_customization/static/src/binary/ir_attachment/{attachment2.id}-Anotherattachment" />
                <field name="res_id" ref="{self.get_xmlid(some_record)}" />
                <field name="res_model">test.studio_export.model1</field>
                <field name="res_field">attachment_ids</field>
            </record>""",
        )
        export.assertRecords(
            "data/test_studio_export_model1.xml",
            f"""<record id="{self.get_xmlid(some_record)}" model="test.studio_export.model1">
                <field name="name">Some record</field>
            </record>""",
        )

    def test_export_records_filter(self):
        # Test that only records created by the user are exported
        # Create record with module and xmlid => not exported by default
        def create_super_user_record(name):
            record = self.env["test.studio_export.model1"].with_user(SUPERUSER_ID).create({
                "name": name,
            })

            self.env.cr.execute("""
                UPDATE
                test_studio_export_model1
                SET create_date = '2015-01-01 00:00:00'
            """)
            self.env['test.studio_export.model1'].invalidate_model(['create_date'])
            self.env['ir.model.data'].create({
                'name': name.lower(),
                'module': "test_web_studio",
                'model': record._name,
                'res_id': record.id,
            })
            return record

        create_super_user_record("Foo")
        server_created_record = create_super_user_record("Bar")

        # Update record with xmlid => exported
        server_created_record.with_user(2).write({"name": "Bar Updated"})

        # Create record without module or xmlid => exported
        user_created_record = self.TestModel.sudo().create({"name": "Normal user record"})

        self.create_export_model(self.TestModel._name)

        export = self.studio_export()
        export.assertFileList("data/test_studio_export_model1.xml")
        export.assertRecords(
            "data/test_studio_export_model1.xml",
            f"""<record id="{self.get_xmlid(user_created_record)}" model="test.studio_export.model1">
                <field name="name">Normal user record</field>
            </record>""",
            """<record id="test_web_studio.bar" model="test.studio_export.model1" forcecreate="1">
                <field name="name">Bar Updated</field>
            </record>""",
        )

    def test_empty_models_and_fields(self):
        # Test that models without records do not export any data
        # and empty fields are not exported

        model2_record1 = self.TestModel2.create({
            "name": "Some Record"
        })
        model2_record2 = self.TestModel2.create({
            "name": "",
            "model2_id": model2_record1.id
        })

        self.create_export_model(self.TestModel2._name)
        self.create_export_model(self.TestModel3._name)

        export = self.studio_export()
        export.assertManifest(
            data=[
                "data/test_studio_export_model2.xml",
            ],
        )
        export.assertFileList(
            "data/test_studio_export_model2.xml",
        )

        export.assertRecords(
            "data/test_studio_export_model2.xml",
            f"""<record id="{self.get_xmlid(model2_record1)}" model="test.studio_export.model2">
                <field name="name">Some Record</field>
            </record>""",
            f"""<record id="{self.get_xmlid(model2_record2)}" model="test.studio_export.model2">
                <field name="model2_id" ref="{self.get_xmlid(model2_record1)}"/>
            </record>""",
        )

    def test_export_data_related_to_demo(self):
        # Test that master data (non demo) does not export fields related
        # to demo records, but data records related to demo are also exported
        # as demo with only the fields related to said demo records.

        model3_record = self.TestModel3.create({"name": "Some record"})
        model2_record = self.TestModel2.create({
            "name": "Some other record",
            "model3_id": model3_record.id
        })

        self.create_export_model(self.TestModel2._name, is_demo_data=False)
        self.create_export_model(self.TestModel3._name, is_demo_data=True)

        export = self.studio_export()
        export.assertFileList(
            "data/test_studio_export_model2.xml",
            "demo/test_studio_export_model2.xml",
            "demo/test_studio_export_model3.xml",
        )
        export.assertRecords(
            "data/test_studio_export_model2.xml",
            f"""<record id="{self.get_xmlid(model2_record)}" model="test.studio_export.model2">
                <field name="name">Some other record</field>
            </record>""",
        )
        export.assertRecords(
            "demo/test_studio_export_model3.xml",
            f"""<record id="{self.get_xmlid(model3_record)}" model="test.studio_export.model3">
                <field name="name">Some record</field>
            </record>""",
        )
        export.assertRecords(
            "demo/test_studio_export_model2.xml",
            f"""<record id="{self.get_xmlid(model2_record)}" model="test.studio_export.model2">
                <field name="model3_id" ref="{self.get_xmlid(model3_record)}"/>
            </record>""",
        )

    def test_export_dependencies_order(self):
        # Test that files and records order respects dependencies

        model3_record = self.TestModel3.create({"name": "Some record"})
        model2_record = self.TestModel2.create({
            "name": "Some other record",
            "model3_id": model3_record.id
        })
        model2b_record = self.TestModel2.create({
            "name": "Some other record",
            "model2_id": model2_record.id,
            "model3_id": model3_record.id
        })

        self.create_export_model(self.TestModel2._name)
        self.create_export_model(self.TestModel3._name)

        export = self.studio_export()
        export.assertManifest(
            data=[
                "data/test_studio_export_model3.xml",
                "data/test_studio_export_model2.xml",
            ],
        )
        export.assertFileList(
            "data/test_studio_export_model3.xml",
            "data/test_studio_export_model2.xml",
        )
        export.assertRecords(
            "data/test_studio_export_model3.xml",
            f"""<record id="{self.get_xmlid(model3_record)}" model="test.studio_export.model3">
                <field name="name">Some record</field>
            </record>""",
        )
        export.assertRecords(
            "data/test_studio_export_model2.xml",
            f"""<record id="{self.get_xmlid(model2_record)}" model="test.studio_export.model2">
                <field name="name">Some other record</field>
                <field name="model3_id" ref="{self.get_xmlid(model3_record)}"/>
            </record>""",
            f"""<record id="{self.get_xmlid(model2b_record)}" model="test.studio_export.model2">
                <field name="name">Some other record</field>
                <field name="model2_id" ref="{self.get_xmlid(model2_record)}"/>
                <field name="model3_id" ref="{self.get_xmlid(model3_record)}"/>
            </record>""",
        )

    def test_export_handles_circular_dependencies(self):
        # Test that models circular dependencies appear in warning.txt
        # and only if some records causes it
        model3_record = self.TestModel3.create({
            "name": "Record 3",
        })
        model2_record = self.TestModel2.create({
            "name": "Record 2",
            "model3_id": model3_record.id
        })
        model1_record = self.TestModel.create({
            "name": "Record 1",
            "model2_id": model2_record.id
        })
        model3_record.update({"model1_id": model1_record.id})

        self.create_export_model(self.TestModel._name)
        self.create_export_model(self.TestModel2._name)
        self.create_export_model(self.TestModel3._name)

        export = self.studio_export()
        export.assertFileList(
            "warnings.txt",
            "data/test_studio_export_model1.xml",
            "data/test_studio_export_model2.xml",
            "data/test_studio_export_model3.xml",
        )

        export.assertRecords(
            "data/test_studio_export_model1.xml",
            f"""<record id="{self.get_xmlid(model1_record)}" model="test.studio_export.model1">
                <field name="name">Record 1</field>
                <field name="model2_id" ref="{self.get_xmlid(model2_record)}"/>
            </record>""",
        )
        export.assertRecords(
            "data/test_studio_export_model2.xml",
            f"""<record id="{self.get_xmlid(model2_record)}" model="test.studio_export.model2">
                <field name="name">Record 2</field>
                <field name="model3_id" ref="{self.get_xmlid(model3_record)}"/>
            </record>""",
        )
        export.assertRecords(
            "data/test_studio_export_model3.xml",
            f"""<record id="{self.get_xmlid(model3_record)}" model="test.studio_export.model3">
                <field name="name">Record 3</field>
                <field name="model1_id" ref="{self.get_xmlid(model1_record)}"/>
            </record>""",
        )

        export.assertFileContains(
            "warnings.txt",
            f"""Found 1 circular dependencies (you may have to change data loading order to avoid issues when importing):
(data) {self.TestModel._name} -> {self.TestModel2._name} -> {self.TestModel3._name} -> {self.TestModel._name}
""",
        )
