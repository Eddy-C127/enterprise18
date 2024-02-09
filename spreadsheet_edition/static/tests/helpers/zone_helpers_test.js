/** @odoo-module */

import { mergeContiguousZones } from "../../src/bundle/helpers/zone_helpers";
import { helpers } from "@odoo/o-spreadsheet";

const { toZone } = helpers;

QUnit.module("spreadsheet > zone helpers", {});

QUnit.test("mergeContiguousZones: can merge two contiguous zones", (assert) => {
    let zones = mergeContiguousZones([toZone("A1:A6"), toZone("B1:B6")]);
    assert.deepEqual(zones, [toZone("A1:B6")]);

    zones = mergeContiguousZones([toZone("A1:D1"), toZone("A2:D2")]);
    assert.deepEqual(zones, [toZone("A1:D2")]);

    zones = mergeContiguousZones([toZone("A1:A6"), toZone("B2")]);
    assert.deepEqual(zones, [toZone("A1:B6")]);

    zones = mergeContiguousZones([toZone("C1"), toZone("A2:F2")]);
    assert.deepEqual(zones, [toZone("A1:F2")]);

    // Not contiguous
    zones = mergeContiguousZones([toZone("C1"), toZone("C3")]);
    assert.deepEqual(zones, [toZone("C1"), toZone("C3")]);
});

QUnit.test("mergeContiguousZones: can merge two overlapping zones", (assert) => {
    let zones = mergeContiguousZones([toZone("A1:A6"), toZone("A1:C4")]);
    assert.deepEqual(zones, [toZone("A1:C6")]);

    zones = mergeContiguousZones([toZone("A1:C6"), toZone("A1:B5")]);
    assert.deepEqual(zones, [toZone("A1:C6")]);
});

QUnit.test("mergeContiguousZones: can merge overlapping and contiguous zones", (assert) => {
    const zones = mergeContiguousZones([toZone("A1:A6"), toZone("A1:C4"), toZone("A7")]);
    assert.deepEqual(zones, [toZone("A1:C7")]);
});
