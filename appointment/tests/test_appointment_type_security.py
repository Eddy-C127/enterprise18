# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.addons.appointment.tests.common import AppointmentSecurityCommon
from odoo.exceptions import AccessError
from odoo.tests import tagged, users
from odoo.tools import mute_logger


@tagged('security')
class TestAppointmentTypeSecurity(AppointmentSecurityCommon):

    @users('apt_manager')
    @mute_logger('odoo.addons.base.models.ir_model', 'odoo.addons.base.models.ir_rule')
    def test_appointment_type_access_apt_manager(self):
        """  Test security access to appointment.type for the group_appointment_manager.
        Can read / write / create / unlink any appointment type.
        """
        self._prepare_types_with_user()
        # Can read, write, unlink any appointment type
        for appointment_type in self.all_apt_types:
            with self.subTest(appointment_type=appointment_type):
                appointment_type.read(['name'])
                appointment_type.write({'is_published': True})
                appointment_type.unlink()
        # Can create an appointment type
        self.env['appointment.type'].create({
            'name': 'Test Create'
        })

    @users('apt_user')
    @mute_logger('odoo.addons.base.models.ir_model', 'odoo.addons.base.models.ir_rule')
    def test_appointment_type_access_apt_user(self):
        """  Test security access to appointment.type for the group_appointment_user.
        Can create an appointment type.
        Can read every published appointment type.
        Can read / write an appointment type that:
            - is created by the user.
            - has the user in its staff OR doesn't have any staff
            - is resource-based.
        Can unlink an appointment type that:
            - is created by the user.
        """
        self._prepare_types_with_user()
        # Can't read appointment type for which he is not part of staff users
        with self.assertRaises(AccessError):
            self.apt_type_apt_manager.read(['name'])
        with self.assertRaises(AccessError):
            self.apt_type_internal_user.read(['name'])
        (self.apt_type_apt_user + self.apt_type_resource + self.apt_type_no_staff).read(['name'])
        # Can read now that's published
        for appointment_type in self.apt_type_apt_manager + self.apt_type_internal_user:
            with self.subTest(appointment_type=appointment_type):
                appointment_type.with_user(self.apt_manager).write({'is_published': True})
                appointment_type.read(['name'])

        # Can't write on appointment type for which he is not part of staff users
        with self.assertRaises(AccessError):
            self.apt_type_apt_manager.write({'is_published': True})
        with self.assertRaises(AccessError):
            self.apt_type_internal_user.write({'is_published': True})
        (self.apt_type_apt_user + self.apt_type_resource + self.apt_type_no_staff).write({'is_published': True})

        # Can create an appointment type
        created_apt = self.env['appointment.type'].create({
            'name': 'Test Create',
        })

        # Can only unlink appointment types created by himself
        for appointment_type in self.all_apt_types:
            with self.subTest(appointment_type=appointment_type), self.assertRaises(AccessError):
                appointment_type.unlink()
        created_apt.unlink()

    @users('internal_user')
    @mute_logger('odoo.addons.base.models.ir_model', 'odoo.addons.base.models.ir_rule')
    def test_appointment_type_access_internal_user(self):
        """  Test security access to appointment.type for the base.group_user.
        Can read an appointment type that:
            - is published.
            - has the user in its staff OR doesn't have any staff
            - is resource-based.
        Can't write / create / unlink any appointment type.
        """
        self._prepare_types_with_user()
        # Can't read appointment type for which he is not part of staff users
        with self.assertRaises(AccessError):
            self.apt_type_apt_manager.read(['name'])
        with self.assertRaises(AccessError):
            self.apt_type_apt_user.read(['name'])
        (self.apt_type_internal_user + self.apt_type_resource + self.apt_type_no_staff).read(['name'])
        # Can read now that's published
        for appointment_type in self.apt_type_apt_manager + self.apt_type_apt_user:
            with self.subTest(appointment_type=appointment_type):
                appointment_type.with_user(self.apt_manager).write({'is_published': True})
                appointment_type.read(['name'])
        # Can't create an appointment type
        with self.assertRaises(AccessError):
            self.env['appointment.type'].create({
                'name': 'Test Create'
            })
        # Can't write or unlink any appointment type
        for appointment_type in self.all_apt_types:
            with self.subTest(appointment_type=appointment_type):
                with self.assertRaises(AccessError):
                    appointment_type.write({'is_published': True})
                with self.assertRaises(AccessError):
                    appointment_type.unlink()

    @users('public_user')
    @mute_logger('odoo.addons.base.models.ir_model', 'odoo.addons.base.models.ir_rule')
    def test_appointment_type_access_public_user(self):
        """  Test security access to appointment.type for the base.group_public.
        Can't read / write / create / unlink any appointment type.
        """
        self._prepare_types_with_user()
        # Can't read / write / unlink any appointment type
        for appointment_type in self.all_apt_types:
            with self.subTest(appointment_type=appointment_type):
                with self.assertRaises(AccessError):
                    appointment_type.read(['name'])
                with self.assertRaises(AccessError):
                    appointment_type.write({'is_published': True})
                with self.assertRaises(AccessError):
                    appointment_type.unlink()
        # Can't create an appointment type
        with self.assertRaises(AccessError):
            self.env['appointment.type'].create({
                'name': 'Test Create'
            })

    def _prepare_types_with_user(self):
        """ Prepare the appointment types by applying the user to be the one from the environment. """
        self.apt_type_apt_manager = self.apt_type_apt_manager.with_user(self.env.user)
        self.apt_type_apt_user = self.apt_type_apt_user.with_user(self.env.user)
        self.apt_type_internal_user = self.apt_type_internal_user.with_user(self.env.user)
        self.apt_type_resource = self.apt_type_resource.with_user(self.env.user)
        self.apt_type_no_staff = self.apt_type_no_staff.with_user(self.env.user)
        self.all_apt_types = self.apt_type_apt_manager + self.apt_type_apt_user + self.apt_type_internal_user + self.apt_type_resource + self.apt_type_no_staff
