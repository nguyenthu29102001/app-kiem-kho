import assert from "node:assert/strict";
import test from "node:test";

import {
  parseInventoryQuantity,
  setInventoryQuantity,
  shouldExportBeforeCompleting,
} from "../app/inventory.ts";
import {
  extractSpreadsheetId,
  googleSheetTabName,
  isGoogleAppsScriptUrl,
} from "../app/google-sheet-sync.ts";

test("accepts decimal quantities with dot or comma", () => {
  assert.equal(parseInventoryQuantity("12.5"), 12.5);
  assert.equal(parseInventoryQuantity("12,5"), 12.5);
});

test("replaces current quantity instead of adding to it", () => {
  const original = [{
    productId: "coffee",
    quantity: 10,
    updatedAt: "2026-07-28T00:00:00.000Z",
  }];
  const updated = setInventoryQuantity(
    original,
    "coffee",
    2.75,
    "2026-07-28T01:00:00.000Z",
  );

  assert.equal(updated.length, 1);
  assert.equal(updated[0].quantity, 2.75);
  assert.equal(updated[0].updatedAt, "2026-07-28T01:00:00.000Z");
});

test("adds a line when the product has not been counted", () => {
  const updated = setInventoryQuantity([], "milk", 0.5, "2026-07-28T01:00:00.000Z");
  assert.deepEqual(updated, [{
    productId: "milk",
    quantity: 0.5,
    updatedAt: "2026-07-28T01:00:00.000Z",
  }]);
});

test("exports automatically only when a non-empty session has not been exported", () => {
  assert.equal(shouldExportBeforeCompleting("session-1", 2, ""), true);
  assert.equal(shouldExportBeforeCompleting("session-1", 2, "session-1"), false);
  assert.equal(shouldExportBeforeCompleting("session-1", 0, ""), false);
});

test("validates Google Sheet and Apps Script links", () => {
  assert.equal(
    extractSpreadsheetId("https://docs.google.com/spreadsheets/d/sheet_123-ABC/edit#gid=0"),
    "sheet_123-ABC",
  );
  assert.equal(extractSpreadsheetId("https://example.com/not-a-sheet"), "");
  assert.equal(
    isGoogleAppsScriptUrl("https://script.google.com/macros/s/deployment_123-ABC/exec"),
    true,
  );
  assert.equal(isGoogleAppsScriptUrl("https://script.google.com/home"), false);
});

test("names Google Sheet tabs using the inventory session date", () => {
  assert.equal(googleSheetTabName("2026-07-28T12:00:00.000Z"), "KIỂM KHO - 28-07-2026");
});
