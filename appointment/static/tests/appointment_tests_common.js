import { fields, models } from "@web/../tests/web_test_helpers";
export class Users extends models.Model {
    _name = "res.users";
    id = fields.Integer({ string: "ID" });
    name = fields.Char({ string: "Name" });
    partner_id = fields.Many2one({ string: "Partner", relation: "res.partner" });

    _records = [
        { id: 1, name: "User 1", partner_id: 1 },
        { id: 214, name: "User 214", partner_id: 214 },
        { id: 216, name: "User 216", partner_id: 216 },
    ];
}

export class Partner extends models.Model {
    _name = "res.partner";
    id = fields.Integer({ string: "ID" });
    name = fields.Char({ string: "Name" });
    email = fields.Char({ string: "email" });
    phone = fields.Char({ string: "phone" });
    display_name = fields.Char({ string: "Displayed name" });
    user_ids = fields.One2many({
        string: "Users",
        relation: "res.users",
        relation_field: "partner_id",
    });

    _records = [
        {
            id: 1,
            display_name: "Partner 1",
            name: "Partner 1",
            email: "partner1@test.lan",
            phone: "0467121212",
            user_ids: [1],
        },
        {
            id: 214,
            display_name: "Partner 214",
            name: "Partner 214",
            email: "",
            phone: "012123123",
            user_ids: [214],
        },
        {
            id: 216,
            display_name: "Partner 216",
            name: "Partner 216",
            email: "partner216@test.lan",
            phone: "",
            user_ids: [216],
        },
        {
            id: 217,
            display_name: "Contact Partner",
            name: "Contact Partner",
            email: "partner@contact.lan",
            phone: "",
            user_ids: [],
        },
    ];
}

export class CalendarEvent extends models.Model {
    _name = "calendar.event";
    id = fields.Integer({ string: "ID" });
    name = fields.Char({ string: "Name" });
    user_id = fields.Many2one({ string: "User", relation: "res.users" });
    partner_id = fields.Many2one({
        string: "Partner",
        relation: "res.partner",
        related: "user_id.partner_id",
    });
    start_date = fields.Date({ string: "Start date" });
    stop_date = fields.Date({ string: "Stop date" });
    start = fields.Datetime({ string: "Start datetime" });
    stop = fields.Datetime({ string: "Stop datetime" });
    allday = fields.Boolean({ string: "Allday" });
    partner_ids = fields.Many2many({ string: "Attendees", relation: "res.partner" });
    appointment_attended = fields.Boolean({ string: "Attended" });
    appointment_type_id = fields.Many2one({
        string: "Appointment Type",
        relation: "appointment.type",
    });

    _records = [
        {
            id: 1,
            user_id: 1,
            partner_id: 1,
            name: "Event 1",
            start: "2022-01-12 10:00:00",
            stop: "2022-01-12 11:00:00",
            allday: false,
            appointment_attended: false,
            partner_ids: [1, 214],
        },
        {
            id: 2,
            user_id: 214,
            partner_id: 214,
            name: "Event 2",
            start: "2022-01-05 10:00:00",
            stop: "2022-01-05 11:00:00",
            allday: false,
            appointment_attended: false,
            partner_ids: [214, 216],
        },
        {
            id: 3,
            user_id: 216,
            partner_id: 216,
            name: "Event 3",
            start: "2022-01-05 10:00:00",
            stop: "2022-01-05 11:00:00",
            allday: false,
            appointment_attended: false,
            partner_ids: [216, 1, 214, 217],
        },
    ];
    check_access_rights = function () {
        return Promise.resolve(true);
    };
}

export class AppointmentType extends models.Model {
    _name = "appointment.type";
    name = fields.Char();
    website_url = fields.Char();
    staff_user_ids = fields.Many2many({ relation: "res.users" });
    website_published = fields.Boolean();
    slot_ids = fields.One2many({ relation: "appointment.slot" });
    schedule_based_on = fields.Selection({
        selection: [
            ["users", "Users"],
            ["resources", "Resources"],
        ],
    });
    category = fields.Selection({
        selection: [
            ["website", "Website"],
            ["custom", "Custom"],
        ],
    });

    _records = [
        {
            id: 1,
            name: "Very Interesting Meeting",
            website_url: "/appointment/1",
            website_published: true,
            schedule_based_on: "users",
            staff_user_ids: [214, 216],
            category: "website",
        },
        {
            id: 2,
            name: "Test Appointment",
            website_url: "/appointment/2",
            website_published: true,
            schedule_based_on: "users",
            staff_user_ids: [1],
            category: "website",
        },
    ];
}

export class AppointmentSlot extends models.Model {
    _name = "appointment.slot";

    appointment_type_id = fields.Many2one({ relation: "appointment.type" });
    start_datetime = fields.Datetime({ string: "Start" });
    end_datetime = fields.Datetime({ string: "End" });
    duration = fields.Float({ string: "Duration" });
    slot_type = fields.Selection({
        string: "Slot Type",
        selection: [
            ["recurring", "Recurring"],
            ["unique", "One Shot"],
        ],
    });
}

export class FilterPartner extends models.Model {
    _name = "filter.partner";

    id = fields.Integer({ string: "ID", type: "integer" });
    user_id = fields.Many2one({ string: "user", relation: "res.users" });
    partner_id = fields.Many2one({
        string: "partner",
        relation: "res.partner",
    });
    partner_checked = fields.Boolean({ string: "checked", type: "boolean" });

    _records = [
        {
            id: 4,
            user_id: 1,
            partner_id: 1,
            partner_checked: true,
        },
        {
            id: 5,
            user_id: 214,
            partner_id: 214,
            partner_checked: true,
        },
    ];
}
