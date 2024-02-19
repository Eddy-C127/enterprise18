/** @odoo-module **/
import { stores } from "@odoo/o-spreadsheet";
import { addGlobalFilter } from "@spreadsheet/../tests/utils/commands";
import { makeStore } from "@spreadsheet/../tests/utils/stores";

const { ComposerStore } = stores;

QUnit.module("spreadsheet global filter auto complete");

QUnit.test("ODOO.FILTER.VALUE", async function (assert) {
    const { store: composer, model } = await makeStore(ComposerStore);
    await addGlobalFilter(model, {
        label: "filter 1",
        id: "42",
        type: "relation",
        defaultValue: [41],
    });
    await addGlobalFilter(model, {
        label: "filter 2",
        id: "43",
        type: "relation",
        defaultValue: [41],
    });
    for (const formula of [
        "=ODOO.FILTER.VALUE(",
        '=ODOO.FILTER.VALUE("',
        '=ODOO.FILTER.VALUE("fil',
        "=ODOO.FILTER.VALUE(fil",
    ]) {
        composer.startEdition(formula);
        const autoComplete = composer.autocompleteProvider;
        assert.deepEqual(
            autoComplete.proposals,
            [
                {
                    htmlContent: [{ color: "#00a82d", value: '"filter 1"' }],
                    text: '"filter 1"',
                },
                {
                    htmlContent: [{ color: "#00a82d", value: '"filter 2"' }],
                    text: '"filter 2"',
                },
            ],
            `autocomplete proposals for ${formula}`
        );
        autoComplete.selectProposal(autoComplete.proposals[0].text);
        assert.strictEqual(composer.currentContent, '=ODOO.FILTER.VALUE("filter 1"');
        assert.strictEqual(composer.autocompleteProvider, undefined, "autocomplete closed");
        composer.cancelEdition();
    }
});

QUnit.test("escape double quotes in filter name", async function (assert) {
    const { store: composer, model } = await makeStore(ComposerStore);
    await addGlobalFilter(model, {
        label: 'my "special" filter',
        id: "42",
        type: "relation",
        defaultValue: [41],
    });
    composer.startEdition("=ODOO.FILTER.VALUE(");
    const autoComplete = composer.autocompleteProvider;
    assert.deepEqual(autoComplete.proposals[0], {
        htmlContent: [{ color: "#00a82d", value: '"my \\"special\\" filter"' }],
        text: '"my \\"special\\" filter"',
    });
    autoComplete.selectProposal(autoComplete.proposals[0].text);
});
