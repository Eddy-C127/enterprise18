import { PivotSidePanelStore } from "@spreadsheet_edition/bundle/pivot/side_panels/pivot_detail_side_panel_store";
import { getBasicData } from "@spreadsheet/../tests/utils/data";
import { createSpreadsheetWithPivot } from "@spreadsheet/../tests/utils/pivot";
import { makeStoreWithModel } from "@spreadsheet/../tests/utils/stores";

QUnit.module("spreadsheet pivot side panel store");

QUnit.test("deferred updates", async (assert) => {
    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="foo" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    assert.strictEqual(store.isDirty, false);
    store.update({ columns: [{ name: "bar" }] });
    assert.strictEqual(store.isDirty, true);
    assert.deepEqual(store.definition.columns[0].name, "bar");
    assert.deepEqual(store.definition.rows[0].name, "foo");
    let definition = JSON.parse(JSON.stringify(model.getters.getPivotDefinition(pivotId)));
    assert.deepEqual(definition.columns, [{ name: "product_id" }], "updates are defered");
    assert.deepEqual(definition.rows, [{ name: "foo" }], "updates are defered");
    store.applyUpdate();
    assert.strictEqual(store.isDirty, false);
    definition = JSON.parse(JSON.stringify(model.getters.getPivotDefinition(pivotId)));
    assert.deepEqual(definition.columns, [{ name: "bar" }]);
    assert.deepEqual(definition.rows, [{ name: "foo" }]);
});

QUnit.test("uncheck the defer updates checkbox applies the update", async (assert) => {
    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
                <field name="product_id" type="col"/>
                <field name="foo" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    assert.strictEqual(store.isDirty, false);
    store.update({ columns: [{ name: "bar" }] });
    store.deferUpdates(false);
    const definition = JSON.parse(JSON.stringify(model.getters.getPivotDefinition(pivotId)));
    assert.deepEqual(definition.columns, [{ name: "bar" }]);
    assert.deepEqual(definition.rows, [{ name: "foo" }]);
    assert.strictEqual(store.isDirty, false);
});

QUnit.test("remove row then add col", async (assert) => {
    const { model, pivotId } = await createSpreadsheetWithPivot({
        arch: /* xml */ `
            <pivot>
                <field name="foo" type="row"/>
                <field name="probability" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    store.update({ rows: [] });
    store.update({ columns: [{ name: "bar" }] });
    assert.deepEqual(store.definition.rows, []);
    assert.strictEqual(store.definition.columns.length, 1);
    assert.deepEqual(store.definition.columns[0].name, "bar");
});

QUnit.test("non-groupable fields are filtered", async (assert) => {
    const models = getBasicData();
    models.partner.fields = {
        foo: {
            string: "Foo",
            type: "integer",
            store: true,
            searchable: true,
            aggregator: "sum",
            groupable: true,
        },
        bar: {
            string: "Bar",
            type: "boolean",
            store: true,
            sortable: true,
            groupable: false,
            searchable: true,
        },
    };
    models.partner.records = [];
    const { model, pivotId } = await createSpreadsheetWithPivot({
        serverData: { models },
        arch: /* xml */ `
            <pivot>
                <field name="__count" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    assert.strictEqual(store.unusedGroupableFields.length, 1);
    assert.strictEqual(store.unusedGroupableFields[0].name, "foo");
});

QUnit.test("fields already used are filtered", async (assert) => {
    const models = getBasicData();
    models.partner.fields = {
        foo: {
            string: "Foo",
            type: "integer",
            store: true,
            searchable: true,
            aggregator: "sum",
            groupable: true,
        },
        bar: {
            string: "Bar",
            type: "boolean",
            store: true,
            sortable: true,
            groupable: true,
            searchable: true,
        },
        baz: {
            string: "Baz",
            type: "boolean",
            store: true,
            sortable: true,
            groupable: true,
            searchable: true,
        },
    };
    models.partner.records = [];
    const { model, pivotId } = await createSpreadsheetWithPivot({
        serverData: { models },
        arch: /* xml */ `
            <pivot>
                <field name="bar" type="col"/>
                <field name="foo" type="row"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    assert.strictEqual(store.unusedGroupableFields.length, 1);
    assert.strictEqual(store.unusedGroupableFields[0].name, "baz");
    store.update({ columns: [{ name: "bar" }, { name: "baz" }] });
    assert.strictEqual(store.unusedGroupableFields.length, 0);
});

QUnit.test("can reuse date fields until all granularities are used", async (assert) => {
    const models = getBasicData();
    models.partner.fields = {
        create_date: {
            string: "Create date",
            type: "datetime",
            store: true,
            groupable: true,
        },
    };
    models.partner.records = [];
    const { model, pivotId } = await createSpreadsheetWithPivot({
        serverData: { models },
        arch: /* xml */ `
            <pivot>
                <field name="__count" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    assert.strictEqual(store.unusedGroupableFields.length, 1);
    assert.deepEqual(
        store.unusedGroupableFields.map((m) => m.name),
        ["create_date"]
    );
    store.update({
        columns: [
            { name: "create_date", granularity: "year" },
            { name: "create_date", granularity: "quarter" },
            { name: "create_date", granularity: "month" },
        ],
    });
    assert.strictEqual(store.unusedGroupableFields.length, 1);
    store.update({
        columns: [
            { name: "create_date", granularity: "year" },
            { name: "create_date", granularity: "quarter" },
            { name: "create_date", granularity: "month" },
            { name: "create_date", granularity: "week" },
            { name: "create_date", granularity: "day" },
        ],
    });
    assert.strictEqual(store.unusedGroupableFields.length, 0);
});

QUnit.test("add default datetime granularity", async (assert) => {
    const models = getBasicData();
    models.partner.fields = {
        create_date: {
            string: "Create date",
            type: "datetime",
            store: true,
            groupable: true,
        },
    };
    models.partner.records = [];
    const { model, pivotId } = await createSpreadsheetWithPivot({
        serverData: { models },
        arch: /* xml */ `
            <pivot>
                <field name="__count" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);

    store.update({ columns: [{ name: "create_date" }] });
    assert.strictEqual(store.definition.columns[0].granularity, "year");

    store.update({ columns: [{ name: "create_date" }, { name: "create_date" }] });
    assert.strictEqual(store.definition.columns[0].granularity, "year");
    assert.strictEqual(store.definition.columns[1].granularity, "quarter");

    store.update({
        columns: [{ name: "create_date", granularity: "month" }, { name: "create_date" }],
    });
    assert.strictEqual(store.definition.columns[0].granularity, "month");
    assert.strictEqual(store.definition.columns[1].granularity, "year");

    store.update({
        columns: [{ name: "create_date" }, { name: "create_date" }, { name: "create_date" }],
    });
    assert.strictEqual(store.definition.columns[0].granularity, "year");
    assert.strictEqual(store.definition.columns[1].granularity, "quarter");
    assert.strictEqual(store.definition.columns[2].granularity, "month");
});

QUnit.test("non measure fields are filtered and sorted", async (assert) => {
    const models = getBasicData();
    models.partner.fields = {
        foo: {
            string: "Foo",
            type: "integer",
            store: true,
        },
        bar: {
            string: "Bar",
            type: "boolean",
            store: true,
        },
        probability: {
            string: "Probability",
            type: "integer",
            aggregator: "sum",
            store: true,
        },
        dummy_float: {
            string: "Dummy float",
            type: "float",
            aggregator: "sum",
            store: true,
        },
        dummy_monetary: {
            string: "Dummy monetary",
            type: "monetary",
            aggregator: "sum",
            store: true,
        },
        dummy_many2one: {
            string: "Dummy many2one",
            type: "many2one",
            aggregator: "sum",
            store: true,
        },
        dummy_binary: {
            string: "Dummy binary",
            type: "binary",
            aggregator: "sum",
            store: true,
        },
        foo_non_stored: {
            string: "Foo non stored",
            type: "integer",
            aggregator: "sum",
            store: false,
        },
    };
    models.partner.records = [];
    const { model, pivotId } = await createSpreadsheetWithPivot({
        serverData: { models },
        arch: /* xml */ `
            <pivot>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    assert.strictEqual(store.unusedMeasureFields.length, 5);
    const measures = ["__count", "dummy_float", "dummy_many2one", "dummy_monetary", "probability"];
    assert.deepEqual(
        store.unusedMeasureFields.map((m) => m.name),
        measures
    );
});

QUnit.test("Existing measure and dimensions fields are filtered", async (assert) => {
    const models = getBasicData();
    models.partner.fields = {
        foo: {
            string: "Foo",
            type: "integer",
            aggregator: "sum",
            store: true,
        },
        bar: {
            string: "Bar",
            type: "boolean",
            store: true,
        },
        probability: {
            string: "Probability",
            type: "integer",
            aggregator: "sum",
            store: true,
        },
        product_id: {
            string: "Product",
            type: "many2one",
            groupable: true,
            store: true,
        },
    };
    models.partner.records = [];
    const { model, pivotId } = await createSpreadsheetWithPivot({
        serverData: { models },
        arch: /* xml */ `
            <pivot>
                <field name="product_id" type="row"/>
                <field name="__count" type="measure"/>
            </pivot>`,
    });
    const { store } = makeStoreWithModel(model, PivotSidePanelStore, pivotId);
    assert.strictEqual(store.unusedMeasureFields.length, 2);
    const measures = ["foo", "probability"];
    assert.deepEqual(
        store.unusedMeasureFields.map((m) => m.name),
        measures
    );
    store.update({
        measures: [
            { name: "__count", aggregator: "sum" },
            { name: "probability", aggregator: "sum" },
        ],
    });
    assert.strictEqual(store.unusedMeasureFields.length, 1);
    assert.strictEqual(store.unusedMeasureFields[0].name, "foo");
});
