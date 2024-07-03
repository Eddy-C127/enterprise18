import { defineDocumentSpreadsheetModels } from "@documents_spreadsheet/../tests/helpers/data";
import { describe, expect, test } from "@odoo/hoot";
import { stores } from "@odoo/o-spreadsheet";
import { Partner } from "@spreadsheet/../tests/helpers/data";
import { createSpreadsheetWithPivot } from "@spreadsheet/../tests/helpers/pivot";
import { makeStoreWithModel } from "@spreadsheet/../tests/helpers/stores";
import { fields } from "@web/../tests/web_test_helpers";

const { PivotSidePanelStore } = stores;

describe.current.tags("headless");
defineDocumentSpreadsheetModels();

test("deferred updates", async () => {
    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="foo" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    store.deferUpdates(true);
    expect(store.isDirty).toBe(false);
    store.update({ columns: [{ name: "bar" }] });
    expect(store.isDirty).toBe(true);
    expect(store.definition.columns[0].name).toEqual("bar");
    expect(store.definition.rows[0].name).toEqual("foo");
    let definition = JSON.parse(JSON.stringify(model.getters.getPivotCoreDefinition(pivotId)));
    expect(definition.columns).toEqual([{ name: "product_id" }], {
        message: "updates are defered",
    });
    expect(definition.rows).toEqual([{ name: "foo" }], { message: "updates are defered" });
    store.applyUpdate();
    expect(store.isDirty).toBe(false);
    definition = JSON.parse(JSON.stringify(model.getters.getPivotCoreDefinition(pivotId)));
    expect(definition.columns).toEqual([{ name: "bar" }]);
    expect(definition.rows).toEqual([{ name: "foo" }]);
});

test("uncheck the defer updates checkbox applies the update", async () => {
    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="foo" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    store.deferUpdates(true);
    expect(store.isDirty).toBe(false);
    store.update({ columns: [{ name: "bar" }] });
    store.deferUpdates(false);
    const definition = JSON.parse(JSON.stringify(model.getters.getPivotCoreDefinition(pivotId)));
    expect(definition.columns).toEqual([{ name: "bar" }]);
    expect(definition.rows).toEqual([{ name: "foo" }]);
    expect(store.isDirty).toBe(false);
});

test("remove row then add col", async () => {
    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
                <field name="foo" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    store.deferUpdates(true);
    store.update({ rows: [] });
    store.update({ columns: [{ name: "bar" }] });
    expect(store.definition.rows).toEqual([]);
    expect(store.definition.columns.length).toBe(1);
    expect(store.definition.columns[0].name).toEqual("bar");
});

test("non-groupable fields are filtered", async () => {
    const foo = fields.Integer({
        string: "Foo",
        store: true,
        searchable: true,
        aggregator: "sum",
        groupable: true,
    });
    const bar = fields.Boolean({
        string: "Bar",
        store: true,
        sortable: true,
        groupable: false,
        searchable: true,
    });
    Partner._rec_name = undefined;
    Partner._fields = { foo, bar };
    Partner._records = [];
    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
                <field name="__count" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    expect(store.unusedGroupableFields.length).toBe(1);
    expect(store.unusedGroupableFields[0].name).toBe("foo");
});

test("fields already used are filtered", async () => {
    const foo = fields.Integer({
        string: "Foo",
        store: true,
        searchable: true,
        aggregator: "sum",
        groupable: true,
    });
    const bar = fields.Boolean({
        string: "Bar",
        store: true,
        sortable: true,
        groupable: false,
        searchable: true,
    });
    const baz = fields.Boolean({
        string: "Baz",
        type: "boolean",
        store: true,
        sortable: true,
        groupable: true,
        searchable: true,
    });
    Partner._rec_name = undefined;
    Partner._fields = { foo, bar, baz };
    Partner._records = [];

    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
                <field name="bar" type="col"/>
                <field name="foo" type="row"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    store.deferUpdates(true);
    expect(store.unusedGroupableFields.length).toBe(1);
    expect(store.unusedGroupableFields[0].name).toBe("baz");
    store.update({ columns: [{ name: "bar" }, { name: "baz" }] });
    expect(store.unusedGroupableFields.length).toBe(0);
});

test("can reuse date fields until all granularities are used", async () => {
    const create_date = fields.Datetime({ string: "Create date", store: true, groupable: true });
    Partner._rec_name = undefined;
    Partner._fields = { create_date };
    Partner._records = [];

    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
                <field name="__count" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    store.deferUpdates(true);
    expect(store.unusedGroupableFields.length).toBe(1);
    expect(store.unusedGroupableFields.map((m) => m.name)).toEqual(["create_date"]);
    store.update({
        columns: [
            { name: "create_date", granularity: "year" },
            { name: "create_date", granularity: "quarter_number" },
            { name: "create_date", granularity: "quarter" },
            { name: "create_date", granularity: "month_number" },
            { name: "create_date", granularity: "month" },
            { name: "create_date", granularity: "iso_week_number" },
            { name: "create_date", granularity: "week" },
            { name: "create_date", granularity: "day_of_month" },
        ],
    });
    expect(store.unusedGroupableFields.length).toBe(1);
    store.update({
        columns: [
            { name: "create_date", granularity: "year" },
            { name: "create_date", granularity: "quarter_number" },
            { name: "create_date", granularity: "quarter" },
            { name: "create_date", granularity: "month_number" },
            { name: "create_date", granularity: "month" },
            { name: "create_date", granularity: "iso_week_number" },
            { name: "create_date", granularity: "week" },
            { name: "create_date", granularity: "day_of_month" },
            { name: "create_date", granularity: "day" },
        ],
    });
    expect(store.unusedGroupableFields.length).toBe(0);
});

test("add default datetime granularity", async () => {
    const create_date = fields.Datetime({ string: "Create date", store: true, groupable: true });
    Partner._rec_name = undefined;
    Partner._fields = { create_date };
    Partner._records = [];

    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
                <field name="__count" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    store.deferUpdates(true);

    store.update({ columns: [{ name: "create_date" }] });
    expect(store.definition.columns[0].granularity).toBe("year");

    store.update({ columns: [{ name: "create_date" }, { name: "create_date" }] });
    expect(store.definition.columns[0].granularity).toBe("year");
    expect(store.definition.columns[1].granularity).toBe("quarter_number");

    store.update({
        columns: [{ name: "create_date", granularity: "month" }, { name: "create_date" }],
    });
    expect(store.definition.columns[0].granularity).toBe("month");
    expect(store.definition.columns[1].granularity).toBe("year");

    store.update({
        columns: [{ name: "create_date" }, { name: "create_date" }, { name: "create_date" }],
    });
    expect(store.definition.columns[0].granularity).toBe("year");
    expect(store.definition.columns[1].granularity).toBe("quarter_number");
    expect(store.definition.columns[2].granularity).toBe("quarter");
});

test("non measure fields are filtered and sorted", async () => {
    const partnerFields = {
        foo: fields.Integer({ string: "Foo", store: true, aggregator: undefined }),
        bar: fields.Boolean({ string: "Bar", store: true }),
        probability: fields.Integer({ string: "Probability", store: true, aggregator: "sum" }),
        dummy_float: fields.Float({ string: "Dummy float", store: true, aggregator: "sum" }),
        dummy_monetary: fields.Monetary({
            string: "Dummy monetary",
            store: true,
            aggregator: "sum",
            currency_field: "currency_id",
        }),
        currency_id: fields.Many2one({
            string: "Currency",
            relation: "res.currency",
            store: false,
        }),
        dummy_many2one: fields.Many2one({
            string: "Dummy many2one",
            store: true,
            aggregator: "sum",
            relation: "res.partner",
        }),
        dummy_binary: fields.Binary({ string: "Dummy binary", store: true, aggregator: "sum" }),
        foo_non_stored: fields.Integer({ string: "Foo non stored", store: false }),
    };
    Partner._rec_name = undefined;
    Partner._fields = partnerFields;
    Partner._records = [];
    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    expect(store.unusedMeasureFields.length).toBe(5);
    const measures = ["__count", "dummy_float", "dummy_many2one", "dummy_monetary", "probability"];
    expect(store.unusedMeasureFields.map((m) => m.name)).toEqual(measures);
});

test("Existing measure and dimensions fields are filtered", async () => {
    const partnerFields = {
        foo: fields.Integer({ string: "Foo", store: true }),
        bar: fields.Boolean({ string: "Bar", store: true }),
        probability: fields.Integer({ string: "Probability", store: true, aggregator: "sum" }),
        product_id: fields.Many2one({
            string: "Product",
            relation: "product",
            store: true,
            groupable: true,
        }),
    };
    Partner._rec_name = undefined;
    Partner._fields = partnerFields;
    Partner._records = [];
    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
                <field name="product_id" type="row"/>
                <field name="__count" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    store.deferUpdates(true);
    expect(store.unusedMeasureFields.length).toBe(2);
    const measures = ["foo", "probability"];
    expect(store.unusedMeasureFields.map((m) => m.name)).toEqual(measures);
    store.update({
        measures: [
            { name: "__count", aggregator: "sum" },
            { name: "probability", aggregator: "sum" },
        ],
    });
    expect(store.unusedMeasureFields.length).toBe(1);
    expect(store.unusedMeasureFields[0].name).toBe("foo");
});
