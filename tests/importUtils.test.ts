import { strict as assert } from "node:assert";
import { normalizeName } from "../base44/shared/importUtils.ts";
assert.equal(normalizeName("  Hello   World "), "hello world");
console.log("harness OK");
