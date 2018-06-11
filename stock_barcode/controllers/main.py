from odoo import http, _
from odoo.http import request

class StockBarcodeController(http.Controller):

    @http.route('/stock_barcode/scan_from_main_menu', type='json', auth='user')
    def main_menu(self, barcode, **kw):
        """ Receive a barcode scanned from the main menu and return the appropriate
            action (open an existing / new picking) or warning.
        """
        ret_open_picking = self.try_open_picking(barcode)
        if ret_open_picking:
            return ret_open_picking

        ret_open_picking_type = self.try_open_picking_type(barcode)
        if ret_open_picking_type:
            return ret_open_picking_type

        if request.env.user.has_group('stock.group_stock_multi_locations'):
            ret_new_internal_picking = self.try_new_internal_picking(barcode)
            if ret_new_internal_picking:
                return ret_new_internal_picking

        if request.env.user.has_group('stock.group_stock_multi_locations'):
            return {'warning': _('No picking or location corresponding to barcode %(barcode)s') % {'barcode': barcode}}
        else:
            return {'warning': _('No picking corresponding to barcode %(barcode)s') % {'barcode': barcode}}

    def try_open_picking_type(self, barcode):
        """ If barcode represent a picking type, open a new
        picking with this type
        """
        picking_type = request.env['stock.picking.type'].search([
            ('barcode', '=', barcode),
        ], limit=1)
        if picking_type:
            # Find source and destination Locations
            location_dest_id, location_id = picking_type.warehouse_id._get_partner_locations()
            if picking_type.default_location_src_id:
                location_id = picking_type.default_location_src_id
            if picking_type.default_location_dest_id:
                location_dest_id = picking_type.default_location_dest_id

            # Create and confirm the picking
            picking = request.env['stock.picking'].create({
                'picking_type_id': picking_type.id,
                'location_id': location_id.id,
                'location_dest_id': location_dest_id.id,
                'immediate_transfer': True,
            })

            # Open its form view
            action_picking_form = request.env.ref('stock_barcode.stock_picking_action_form')
            action_picking_form = action_picking_form.read()[0]
            action_picking_form.update(res_id=picking.id)
            return {'action': action_picking_form}
        return False

    def try_open_picking(self, barcode):
        """ If barcode represents a picking, open it
        """
        corresponding_picking = request.env['stock.picking'].search([
            ('name', '=', barcode),
            ('state', 'in', ('partially_available', 'assigned'))
        ], limit=1)
        if corresponding_picking:
            action_picking_form = request.env.ref('stock_barcode.stock_picking_action_form')
            action_picking_form = action_picking_form.read()[0]
            action_picking_form['res_id'] = corresponding_picking.id
            return {'action': action_picking_form}
        return False

    def try_new_internal_picking(self, barcode):
        """ If barcode represents a location, open a new picking from this location
        """
        corresponding_location = request.env['stock.location'].search([
            ('barcode', '=', barcode),
            ('usage', '=', 'internal')
        ], limit=1)
        if corresponding_location:
            internal_picking_type = request.env['stock.picking.type'].search([('code', '=', 'internal')])
            warehouse = corresponding_location.get_warehouse()
            if warehouse:
                internal_picking_type = internal_picking_type.filtered(lambda r: r.warehouse_id == warehouse)
            dest_loc = corresponding_location
            while dest_loc.location_id and dest_loc.location_id.usage == 'internal':
                dest_loc = dest_loc.location_id
            if internal_picking_type:
                # Create and confirm an internal picking
                picking = request.env['stock.picking'].create({
                    'picking_type_id': internal_picking_type[0].id,
                    'location_id': corresponding_location.id,
                    'location_dest_id': dest_loc.id,
                    'immediate_transfer': True,
                })
                picking.action_confirm()

                # Open its form view
                action_picking_form = request.env.ref('stock_barcode.stock_picking_action_form')
                action_picking_form = action_picking_form.read()[0]
                action_picking_form.update(res_id=picking.id)
                return {'action': action_picking_form}
            else:
                return {'warning': _('No internal operation type. Please configure one in warehouse settings.')}
        return False

    @http.route('/stock_barcode/rid_of_message_demo_barcodes', type='json', auth='user')
    def rid_of_message_demo_barcodes(self, **kw):
        """ Edit the main_menu client action so that it doesn't display the 'print demo barcodes sheet' message """
        action = request.env.ref('stock_barcode.stock_barcode_action_main_menu')
        action and action.sudo().write({'params': {'message_demo_barcodes': False}})
