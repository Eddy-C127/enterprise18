# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.addons import decimal_precision as dp


class TestType(models.Model):
    _inherit = "quality.point.test_type"

    allow_registration = fields.Boolean(search='_get_domain_from_allow_registration',
            store=False, default=False)

    def _get_domain_from_allow_registration(self, operator, value):
        if value:
            return []
        else:
            return [('technical_name', 'not in', ['register_consumed_materials', 'dummy', 'picture'])]


class QualityPoint(models.Model):
    _inherit = "quality.point"

    code = fields.Selection(related='picking_type_id.code')  # TDE FIXME: necessary ?
    operation_id = fields.Many2one('mrp.routing.workcenter', 'Step')
    routing_id = fields.Many2one(related='operation_id.routing_id')
    test_type_id = fields.Many2one(domain="[('allow_registration', '=', operation_id and code == 'mrp_operation')]")
    worksheet = fields.Selection([
        ('noupdate', 'Do not update page'),
        ('scroll', 'Scroll to specific page')], string="Worksheet",
        default="noupdate")
    worksheet_page = fields.Integer('Worksheet Page')
    # Used with type register_consumed_materials the product raw to encode.
    component_id = fields.Many2one('product.product', 'Component')

    @api.onchange('product_id')
    def _onchange_product(self):
        bom_ids = self.env['mrp.bom'].search([('product_tmpl_id', '=', self.product_id.product_tmpl_id.id)])
        component_ids = set([])
        for bom in bom_ids:
            boms_done, lines_done = bom.explode(self.product_id, 1.0)
            component_ids |= {l[1]['product']['id'] for l in lines_done}
        component_ids.discard(self.product_id.id)
        component_ids = list(component_ids)
        routing_ids = bom_ids.mapped('routing_id.id')
        return {'domain': {'operation_id': [('routing_id', 'in', routing_ids)], 'component_id': [('id', 'in', component_ids)]}}


class QualityAlert(models.Model):
    _inherit = "quality.alert"

    workorder_id = fields.Many2one('mrp.workorder', 'Operation')
    workcenter_id = fields.Many2one('mrp.workcenter', 'Work Center')
    production_id = fields.Many2one('mrp.production', "Production Order")

class QualityCheck(models.Model):
    _inherit = "quality.check"

    workorder_id = fields.Many2one('mrp.workorder', 'Operation')
    workcenter_id = fields.Many2one('mrp.workcenter', related='workorder_id.workcenter_id', store=True, readonly=True)  # TDE: necessary ?
    production_id = fields.Many2one('mrp.production', 'Production Order')

    # For components registration
    parent_id = fields.Many2one('quality.check', 'Parent Quality Check')
    component_id = fields.Many2one('product.product', 'Component')
    component_uom_id = fields.Many2one(related='component_id.uom_id', readonly=True)
    move_line_id = fields.Many2one('stock.move.line', 'Move Line')
    qty_done = fields.Float('Done', default=1.0, digits=dp.get_precision('Product Unit of Measure'))
    lot_id = fields.Many2one('stock.production.lot', 'Lot')
    component_is_byproduct = fields.Boolean('Register a by product', default=False)

    # Computed fields
    title = fields.Char('Title', compute='_compute_title')
    result = fields.Char('Result', compute='_compute_result')
    quality_state_for_summary = fields.Char('Status Summary', compute='_compute_result')

    # Used to group the steps belonging to the same production
    # We use a float because it is actually filled in by the produced quantity at the step creation.
    finished_product_sequence = fields.Float('Finished Product Sequence Number')

    def _compute_title(self):
        for check in self:
            if check.point_id:
                check.title = check.point_id.title
            else:
                check.title = '{} "{}"'.format(_('Register component(s)'), check.component_id.name)

    @api.depends('point_id', 'quality_state', 'component_id', 'component_uom_id', 'lot_id', 'qty_done')
    def _compute_result(self):
        for check in self:
            state = check.quality_state
            check.quality_state_for_summary = _('Done') if state != 'none' else _('To Do')
            if check.point_id:
                check.component_id = check.point_id.component_id
            test_type = check.point_id.test_type if check.point_id else 'register_consumed_materials'
            if check.quality_state == 'none':
                check.result = ''
            else:
                check.result = check._get_check_result(test_type)

    def _get_check_result(self, test_type):
        if test_type == 'register_consumed_materials' and self.lot_id:
            return '{} - {}, {} {}'.format(self.component_id.name, self.lot_id.name, self.qty_done, self.component_uom_id.name)
        elif test_type == 'register_consumed_materials' and self.qty_done > 0:
            return '{}, {} {}'.format(self.component_id.name, self.qty_done, self.component_uom_id.name)
        else:
            return ''
