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
    store.update({ colGroupBys: ["bar"] });
    assert.strictEqual(store.isDirty, true);
    assert.deepEqual(store.definition.columns[0].name, "bar");
    assert.deepEqual(store.definition.rows[0].name, "foo");
    let definition = model.getters.getPivotDefinition(pivotId);
    assert.deepEqual(definition.colGroupBys, ["product_id"], "updates are defered");
    assert.deepEqual(definition.rowGroupBys, ["foo"], "updates are defered");
    store.applyUpdate();
    assert.strictEqual(store.isDirty, false);
    definition = model.getters.getPivotDefinition(pivotId);
    assert.deepEqual(definition.colGroupBys, ["bar"]);
    assert.deepEqual(definition.rowGroupBys, ["foo"]);
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
    store.update({ colGroupBys: ["bar"] });
    store.deferUpdates(false);
    const definition = model.getters.getPivotDefinition(pivotId);
    assert.deepEqual(definition.colGroupBys, ["bar"]);
    assert.deepEqual(definition.rowGroupBys, ["foo"]);
    assert.strictEqual(store.isDirty, false);
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
    store.update({ colGroupBys: ["bar", "baz"] });
    assert.strictEqual(store.unusedGroupableFields.length, 0);
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

QUnit.test("Existing measure fields are filtered", async (assert) => {
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
    assert.strictEqual(store.unusedMeasureFields.length, 2);
    const measures = ["foo", "probability"];
    assert.deepEqual(
        store.unusedMeasureFields.map((m) => m.name),
        measures
    );
    store.update({ measures: ["__count", "probability"] });
    assert.strictEqual(store.unusedMeasureFields.length, 1);
    assert.strictEqual(store.unusedMeasureFields[0].name, "foo");
});
