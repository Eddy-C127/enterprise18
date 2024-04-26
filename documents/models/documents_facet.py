# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from random import randint

from odoo import models, fields


class TagsCategories(models.Model):
    _name = "documents.facet"
    _description = "Category"
    _order = "sequence, name"

    def _get_default_color(self):
        return randint(1, 11)

    folder_id = fields.Many2one('documents.folder', string="Workspace", ondelete="cascade")
    name = fields.Char(required=True, translate=True)
    tag_ids = fields.One2many('documents.tag', 'facet_id', copy=True)
    tooltip = fields.Char(help="Text shown when hovering on this tag category or its tags", string="Tooltip")
    sequence = fields.Integer('Sequence', default=10)
    color = fields.Integer('Color', default=_get_default_color)

    _sql_constraints = [
        ('name_unique', 'unique (folder_id, name)', "Facet already exists in this folder"),
    ]
