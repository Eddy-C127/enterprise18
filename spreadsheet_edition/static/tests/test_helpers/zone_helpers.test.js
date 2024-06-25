import { defineSpreadsheetModels } from "@spreadsheet/../tests/helpers/data";
import { describe, expect, test } from "@odoo/hoot";
import { helpers } from "@odoo/o-spreadsheet";

describe.current.tags("headless");
defineSpreadsheetModels();

const { toZone, mergeContiguousZones } = helpers;

test("mergeContiguousZones: can merge two contiguous zones", () => {
    let zones = mergeContiguousZones([toZone("A1:A6"), toZone("B1:B6")]);
    expect(zones).toEqual([toZone("A1:B6")]);

    zones = mergeContiguousZones([toZone("A1:D1"), toZone("A2:D2")]);
    expect(zones).toEqual([toZone("A1:D2")]);

    zones = mergeContiguousZones([toZone("A1:A6"), toZone("B2")]);
    expect(zones).toEqual([toZone("A1:B6")]);

    zones = mergeContiguousZones([toZone("C1"), toZone("A2:F2")]);
    expect(zones).toEqual([toZone("A1:F2")]);

    // Not contiguous
    zones = mergeContiguousZones([toZone("C1"), toZone("C3")]);
    expect(zones).toEqual([toZone("C1"), toZone("C3")]);
});

test("mergeContiguousZones: can merge two overlapping zones", () => {
    let zones = mergeContiguousZones([toZone("A1:A6"), toZone("A1:C4")]);
    expect(zones).toEqual([toZone("A1:C6")]);

    zones = mergeContiguousZones([toZone("A1:C6"), toZone("A1:B5")]);
    expect(zones).toEqual([toZone("A1:C6")]);
});

test("mergeContiguousZones: can merge overlapping and contiguous zones", () => {
    const zones = mergeContiguousZones([toZone("A1:A6"), toZone("A1:C4"), toZone("A7")]);
    expect(zones).toEqual([toZone("A1:C7")]);
});
