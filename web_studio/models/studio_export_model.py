# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
from ast import literal_eval

from odoo import SUPERUSER_ID, Command, api, fields, models
from odoo.exceptions import AccessDenied, AccessError
from odoo.osv import expression

_logger = logging.getLogger(__name__)

# Data to autofill export models when the autofill action is triggered
AUTOFILL_MODELS = [
    ("res.partner", {"domain": "[('user_ids', '=', False)]", "is_demo_data": True, "no_update": True}),
    ("hr.employee", {"is_demo_data": True}),
    ("product.public.category", {"no_update": True}),
    ("project.task.type", {"no_update": True}),
    ("documents.folder", {"no_update": True}),
    ("product.category", {"no_update": True}),
    ("worksheet.template", {}),
    ("account.analytic.plan", {"is_demo_data": True}),
    ("account.analytic.account", {"is_demo_data": True}),
    ("project.project", {"no_update": True}),
    ("uom.category", {"no_update": True}),
    ("uom.uom", {"no_update": True}),
    ("planning.role", {}),
    ("product.template", {"no_update": True}),
    ("crm.tag", {"is_demo_data": True, "no_update": True}),
    ("crm.team", {"is_demo_data": True}),
    ("crm.stage", {"no_update": True}),
    ("crm.lead", {"is_demo_data": True, "no_update": True}),
    ("helpdesk.ticket", {"is_demo_data": True, "no_update": True}),
    ("product.supplierinfo", {"is_demo_data": True, "no_update": True}),
    ("sale.order", {"domain": "[('state', 'not in', ['draft', 'cancel'])]", "is_demo_data": True, "no_update": True}),
    ("sale.order.line", {"is_demo_data": True, "no_update": True}),
    ("project.task", {"is_demo_data": True, "no_update": True}),
    ("project.project.stage", {}),
    ("product.attribute", {}),
    ("product.attribute.value", {"no_update": True}),
    ("product.pricelist", {"no_update": True}),
    ("product.template.attribute.line", {"no_update": True}),
    ("product.template.attribute.value", {"no_update": True}),
    ("product.product", {"no_update": True}),
    ("product.image", {}),
    ("sale.order.template", {"no_update": True}),
    ("sale.order.template.line", {"no_update": True}),
    ("knowledge.cover", {"include_attachment": True, "no_update": True}),
    ("knowledge.article", {"domain": "[('category', 'in', ['workspace', 'shared'])]"}),
    ("website", {"is_demo_data": True, "no_update": True}),
    ("website.page", {"is_demo_data": True, "no_update": True}),
    ("website.menu", {"is_demo_data": True, "no_update": True}),
    ("stock.lot", {"is_demo_data": True}),
    ("purchase.order", {"is_demo_data": True, "no_update": True}),
    ("purchase.order.line", {"is_demo_data": True}),
    ("quality.point", {"no_update": True}),
    ("quality.check", {"is_demo_data": True}),
    ("planning.slot.template", {"is_demo_data": True}),
    ("planning.recurrency", {"is_demo_data": True}),
    ("planning.slot", {"is_demo_data": True}),
    ("survey.survey", {}),
    ("survey.question", {}),
    ("survey.question.answer", {}),
]

# _compute_excluded_fields: default fields to exclude
DEFAULT_FIELDS_TO_EXCLUDE = {
    "res.partner": {
        "ocn_token",
        "signup_type",
        "commercial_partner_id",
        "complete_name",
        "calendar_last_notif_ack",
    },
    "hr.employee": {"employee_token", "resource_calendar_id", "resource_id"},
    "account.analytic.plan": {"complete_name"},
    "product.category": {"complete_name"},
    "product.template": {"type"},
    "product.product": {
        "combination_indices",
        "image_variant_256",
        "image_variant_512",
        "image_variant_1024",
    },
    "knowledge.cover": {"attachment_url"},
    "knowledge.article": {
        "root_article_id",
        "last_edition_date",
        "favorite_count",
    },
    "project.project": {"sale_line_id", "rating_request_deadline"},
    "project.task": {"personal_stage_type_ids", "date_last_stage_update"},
    "project.task.type": {"project_ids"},
    "product.attribute.value": {"pav_attribute_line_ids"},
    "product.public.category": {"product_tmpl_ids"},
    "product.template.attribute.value": {
        "ptav_product_variant_ids",
        "product_tmpl_id",
        "attribute_id",
    },
    "product.template.attribute.line": {"value_count"},
    "sale.order": {
        "name",
        "team_id",
        "transaction_ids",
        "procurement_group_id",
        "require_signature",
        "require_payment",
        "validity_date",
        "note",
        "partner_shipping_id",
        "partner_invoice_id",
        "payment_term_id",
        "state",
        "subscription_state",
        "currency_rate",
        "amount_tax",
        "amount_untaxed",
        "amount_total",
        "amount_to_invoice",
        "invoice_status",
    },
    "sale.order.line": {
        "invoice_lines",
        "product_packaging_id",
        "product_packaging_qty",
        "task_id",
        "price_subtotal",
        "price_tax",
        "price_total",
        "price_reduce_taxexcl",
        "price_reduce_taxinc",
        "qty_delivered_method",
        "qty_delivered",
        "qty_to_invoice",
        "qty_invoiced",
        "invoice_status",
        "untaxed_amount_invoiced",
        "untaxed_amount_to_invoice",
    },
    "purchase.order": {
        "name",
        "origin",
        "invoice_ids",
        "group_id",
        "invoice_count",
        "invoice_status",
        "amount_tax",
        "amount_total",
        "currency_rate",
    },
    "purchase.order.line": {
        "currency_id",
        "product_packaging_id",
        "move_dest_ids",
        "price_subtotal",
        "price_total",
        "price_tax",
        "qty_invoiced",
        "qty_received_method",
        "qty_received",
        "qty_to_invoice",
    },
    "crm.lead": {
        "recurring_plan",
        "title",
        "lost_reason_id",
        "duplicate_lead_ids",
        "lang_id",
        "prorated_revenue",
        "automated_probability",
        "date_last_stage_update",
    },
    "survey.survey": {"session_question_id"},
    "survey.question": {"page_id"},
}

# _compute_excluded_fields: abstract model fields to exclude
ABSTRACT_MODEL_FIELDS_TO_EXCLUDE = {
    "html.field.history.mixin": {"html_field_history_metadata", "html_field_history"},
    "mail.activity.mixin": {"activity_ids"},
    "mail.thread": {"message_follower_ids", "message_ids"},
    "mail.thread.blacklist": {"email_normalized", "is_blacklisted", "message_bounce"},
    "mail.alias.mixin": {"alias_id"},
    "portal.mixin": {"access_url", "access_token", "access_warning"},
    "avatar.mixin": {
        "avatar_1920",
        "avatar_1024",
        "avatar_512",
        "avatar_256",
        "avatar_128",
    },
    # only export image_1920, the other sizes can be generated from it
    "image.mixin": {"image_1024", "image_512", "image_256", "image_128"},
}

# _compute_excluded_fields: relations to exclude
RELATED_MODELS_TO_EXCLUDE = [
    "account.account.tag",
    "account.account",
    "account.bank.statement",
    "account.edi.document",
    "account.fiscal.position",
    "account.full.reconcile",
    "account.journal",
    "account.partial.reconcile",
    "account.payment",
    "account.root",
    "account.tax.repartition.line",
    "account.tax",
]


def _should_export_record(record, xmlids):
    """ Checks if a record should be exported.
        A record should not be exported if for instance it has not been
        modified by a real user.

        Note that the heuristic used here may not be perfect in all cases.
    """
    module_names = {xmlid.split(".")[0] for xmlid in xmlids}
    return (
        not module_names  # new record
        or "studio_customization" in module_names  # from studio customization
        or "__export__" in module_names  # from list export
        or record.create_uid.id != SUPERUSER_ID  # created by a real user
        or (  # modified by a real user
            record.write_uid.id != SUPERUSER_ID
            and record.create_date != record.write_date
        )
    )


class StudioExportModel(models.Model):
    _name = "studio.export.model"
    _description = "Studio Export Models"
    _order = "sequence,id"
    _sql_constraints = [
        ("unique_model", "unique(model_id)", "This model is already being exported."),
    ]

    sequence = fields.Integer()
    model_id = fields.Many2one("ir.model", required=True, ondelete="cascade")
    model_name = fields.Char(string="Model Name", related="model_id.model", store=True)
    excluded_fields = fields.Many2many(
        "ir.model.fields",
        string="Fields to exclude",
        domain="[('model_id', '=', model_id)]",
        compute="_compute_excluded_fields",
        readonly=False,
        store=True,
    )
    domain = fields.Text(default="[]")
    is_demo_data = fields.Boolean(default=False, string="Export as demo data")
    no_update = fields.Boolean(default=False, string="Export with noupdate='1'")
    include_attachment = fields.Boolean(default=False)

    @api.depends("model_id")
    def _compute_excluded_fields(self):
        to_reset = self.filtered(lambda r: not r.model_id)
        to_reset.excluded_fields = None
        for record in self - to_reset:
            RecordModel = self.env[record.model_name]
            fields_not_to_export = DEFAULT_FIELDS_TO_EXCLUDE.get(
                record.model_name, set()
            )

            # also exclude fields of abstract models
            to_search = {m for m in RecordModel._BaseModel__base_classes if m._abstract}
            searched = set()
            while to_search:
                current = to_search.pop()
                if current._name in ABSTRACT_MODEL_FIELDS_TO_EXCLUDE:
                    fields_not_to_export |= ABSTRACT_MODEL_FIELDS_TO_EXCLUDE[current._name]
                searched.add(current)
                to_search |= (
                    {
                        m
                        for m in current._BaseModel__base_classes
                        if m not in searched and m._abstract
                    }
                    if "_BaseModel__base_classes" in dir(current)
                    else set()
                )

            for field_name, field in RecordModel._fields.items():
                # exclude computed fields that can't impact the import
                # exclude one2many fields
                # exclude many2x if comodel is not to export
                # exclude fields created in l10n_* modules
                module = field._modules[0] if field._modules else None
                if (
                    (
                        (field.compute or field.related)
                        and not (field.store or field.company_dependent)
                    )
                    or (field.type == "one2many")
                    or (module and module.startswith("l10n_"))
                    or (
                        field.type in ["many2one", "many2many"]
                        and field.comodel_name in RELATED_MODELS_TO_EXCLUDE
                    )
                ):
                    fields_not_to_export.add(field_name)

            if RecordModel._parent_store:
                fields_not_to_export.add("parent_path")

            excluded_fields = self.env["ir.model.fields"].search(
                [
                    ("model_id", "=", record.model_id.id),
                    ("name", "in", list(fields_not_to_export)),
                ]
            )
            record.excluded_fields = [Command.set(excluded_fields.ids)]

    @api.model
    def action_autofill(self, _=None):
        curr_models = self.search([]).mapped("model_name")
        fill_models = {
            m[0]: index
            for index, m in enumerate(AUTOFILL_MODELS)
            if m[0] not in curr_models
        }
        autofill = self.env["ir.model"].search(
            [("model", "in", list(fill_models.keys()))]
        )
        for model in autofill:
            index = fill_models[model.model]
            default_values = AUTOFILL_MODELS[index][1]
            self.create(
                {
                    **default_values,
                    "model_id": model.id,
                    "sequence": index,
                }
            )

    def _get_exportable_records(self):
        self.ensure_one()
        model_domain = literal_eval(self.domain or "[]")
        if self.model_name == "res.partner":
            # Forced for security purpose: don't export partners linked to users
            model_domain = expression.AND([model_domain, [("user_ids", "=", False)]])

        try:
            records = self.env[self.model_name].search(model_domain)
        except (AccessError, AccessDenied) as e:
            _logger.warning(
                "Access Denied while exporting model(%s) data:\n%s",
                self.model_name,
                e,
            )
            return None

        xmlids = records._get_external_ids()
        return records.filtered(lambda r: _should_export_record(r, xmlids[r.id]))
