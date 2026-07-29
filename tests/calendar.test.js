const test = require('node:test');
const assert = require('node:assert/strict');
const Calendar = require('../src/calendar.js');

function ymd(date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

test('matches the requested current-date example', () => {
  const date = new Date(2026, 6, 29, 12);
  assert.deepEqual(Calendar.getEthiopianParts(date), { year: 2018, month: 11, day: 22 });
  assert.equal(Calendar.formatEthiopian(date, 'am'), 'ረቡዕ — ሐምሌ 22 — 2018 ዓ.ም.');
});

test('finds Ethiopian new year in regular and shifted Gregorian years', () => {
  assert.deepEqual(ymd(Calendar.ethiopianToGregorian(2018, 1, 1)), [2025, 9, 11]);
  assert.deepEqual(ymd(Calendar.ethiopianToGregorian(2016, 1, 1)), [2023, 9, 12]);
});

test('handles Pagumen and Ethiopian leap years', () => {
  assert.equal(Calendar.getYearLength(2018), 365);
  assert.equal(Calendar.getMonthLength(2018, 13), 5);
  assert.equal(Calendar.getYearLength(2019), 366);
  assert.equal(Calendar.getMonthLength(2019, 13), 6);
  assert.deepEqual(ymd(Calendar.ethiopianToGregorian(2015, 13, 6)), [2023, 9, 11]);
});

test('round-trips every day in Ethiopian year 2018', () => {
  const start = Calendar.findYearStart(2018);
  const length = Calendar.getYearLength(2018);
  for (let index = 0; index < length; index += 1) {
    const gregorian = Calendar.addDays(start, index);
    const parts = Calendar.getEthiopianParts(gregorian);
    assert.equal(
      Calendar.toISODate(Calendar.ethiopianToGregorian(parts.year, parts.month, parts.day)),
      Calendar.toISODate(gregorian)
    );
  }
});

test('uses local-day math without UTC date drift', () => {
  const source = new Date(2026, 2, 28, 12);
  const next = Calendar.addDays(source, 1);
  assert.equal(Calendar.diffDays(source, next), 1);
  assert.equal(Calendar.toISODate(Calendar.fromISODate('2026-07-29')), '2026-07-29');
});
