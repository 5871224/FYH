const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("手機打卡只以 300 公尺距離判斷，不因 GPS 精度數值阻擋", () => {
  const source = read("supabase/functions/attendance-clock/index.ts");
  const spec = read("規格書.md");

  assert.match(source, /const MAX_GPS_DISTANCE_METERS = 300;/);
  assert.doesNotMatch(source, /MAX_GPS_ACCURACY_METERS/);
  assert.match(source, /if \(allowGps && latitude !== null && longitude !== null\)/);
  assert.doesNotMatch(source, /accuracy <=/);
  assert.doesNotMatch(source, /accuracy >/);
  assert.match(source, /gpsMatch\.distance <= MAX_GPS_DISTANCE_METERS/);
  assert.match(source, /accuracy,/);
  assert.match(spec, /距公司不超過 300 公尺即通過，不以 GPS 回報的定位精度數值作為阻擋條件/);
});
