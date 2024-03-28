import { fields, models } from "@web/../tests/web_test_helpers";

export class user extends models.Model {
    _name = "res.users";

    name = fields.Char();
    has_group() {
        return true;
    }
}

export class irAttachment extends models.Model {
    _name = "ir.attachment";

    id = fields.Integer();
    name = fields.Char();
    datas = fields.Binary();
    res_model = fields.Char()
    mimetype = fields.Char();

    _records = [{
            id: 1,
            name: "yop.pdf",
            res_model: "sign.template",
            mimetype: "application/pdf"
        },
    ];
}

export class signTemplateTag extends models.Model {
    _name = "sign.template.tag";

    id = fields.Integer();
    name = fields.Char();
    color = fields.Integer();

    _records = [{
            id: 1,
            name: "New",
            color: 1,
        }, {
            id: 2,
            name: "Draft",
            color: 2,
        },
    ];
}

export class signTemplate extends models.Model {
    _name = "sign.template";

    id = fields.Integer();
    display_name = fields.Char();
    attachment_id = fields.Many2one({ relation: "ir.attachment" });
    user_id =  fields.Many2one({ relation: "res.users" });
    tag_ids = fields.Many2many({ relation:'sign.template.tag' });
    color = fields.Integer();
    active = fields.Boolean();

    _records = [{
            id: 1,
            display_name : "yop.pdf",
            attachment_id : 1,
            tag_ids : [1, 2],
            color : 1,
            active : true,
        },
    ];
}

