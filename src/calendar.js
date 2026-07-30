(function exposeCalendar(root, factory) {
  const calendar = factory();
  if (typeof module === 'object' && module.exports) module.exports = calendar;
  if (root) root.ZemenCalendar = calendar;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildCalendar() {
  'use strict';

  const DAY_MS = 86_400_000;
  const yearStartCache = new Map();
  const yearLengthCache = new Map();
  const MAX_CACHED_YEARS = 20;

  const MONTHS = {
    am: [
      'መስከረም',
      'ጥቅምት',
      'ኅዳር',
      'ታኅሣሥ',
      'ጥር',
      'የካቲት',
      'መጋቢት',
      'ሚያዝያ',
      'ግንቦት',
      'ሰኔ',
      'ሐምሌ',
      'ነሐሴ',
      'ጳጉሜን'
    ],
    en: [
      'Meskerem',
      'Tikimt',
      'Hidar',
      'Tahsas',
      'Tir',
      'Yekatit',
      'Megabit',
      'Miazia',
      'Ginbot',
      'Sene',
      'Hamle',
      'Nehase',
      'Pagumen'
    ]
  };

  const WEEKDAYS = {
    am: ['እሑድ', 'ሰኞ', 'ማክሰኞ', 'ረቡዕ', 'ሐሙስ', 'ዓርብ', 'ቅዳሜ'],
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  };

  const numericEthiopicFormatter = new Intl.DateTimeFormat(
    'en-US-u-ca-ethiopic-nu-latn',
    { year: 'numeric', month: 'numeric', day: 'numeric' }
  );

  function atNoon(date) {
    const copy = new Date(date);
    if (Number.isNaN(copy.getTime())) throw new RangeError('Invalid date');
    copy.setHours(12, 0, 0, 0);
    return copy;
  }

  function today() {
    return atNoon(new Date());
  }

  function addDays(date, amount) {
    const copy = atNoon(date);
    copy.setDate(copy.getDate() + Number(amount));
    return copy;
  }

  function localDayNumber(date) {
    const value = atNoon(date);
    return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / DAY_MS;
  }

  function diffDays(from, to) {
    return Math.round(localDayNumber(to) - localDayNumber(from));
  }

  function compareDays(a, b) {
    return Math.sign(localDayNumber(a) - localDayNumber(b));
  }

  function toISODate(date) {
    const value = atNoon(date);
    return [
      String(value.getFullYear()).padStart(4, '0'),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0')
    ].join('-');
  }

  function fromISODate(isoDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || ''));
    if (!match) throw new RangeError('Expected a YYYY-MM-DD date');
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
    if (
      date.getFullYear() !== Number(match[1]) ||
      date.getMonth() !== Number(match[2]) - 1 ||
      date.getDate() !== Number(match[3])
    ) {
      throw new RangeError('Invalid Gregorian date');
    }
    return date;
  }

  function getEthiopianParts(date) {
    const parts = numericEthiopicFormatter.formatToParts(atNoon(date));
    const value = {};
    for (const part of parts) {
      if (part.type === 'year' || part.type === 'month' || part.type === 'day') {
        value[part.type] = Number(part.value);
      }
    }
    if (![value.year, value.month, value.day].every(Number.isInteger)) {
      throw new Error('This system does not provide the Ethiopic calendar through Intl.');
    }
    return value;
  }

  function findYearStart(ethiopianYear) {
    const year = Number(ethiopianYear);
    if (!Number.isInteger(year) || year < 1 || year > 9000) {
      throw new RangeError('Ethiopian year must be an integer from 1 to 9000');
    }
    if (yearStartCache.has(year)) return new Date(yearStartCache.get(year));
    if (yearStartCache.size >= MAX_CACHED_YEARS) {
      const oldest = yearStartCache.keys().next().value;
      yearStartCache.delete(oldest);
      yearLengthCache.delete(oldest);
    }

    // Meskerem 1 falls in September of Gregorian year (Ethiopian year + 7).
    // Scanning a bounded window delegates the calendar conversion to ICU/Intl.
    let cursor = new Date(year + 7, 7, 20, 12);
    for (let index = 0; index < 65; index += 1) {
      const parts = getEthiopianParts(cursor);
      if (parts.year === year && parts.month === 1 && parts.day === 1) {
        yearStartCache.set(year, cursor.getTime());
        return new Date(cursor);
      }
      cursor = addDays(cursor, 1);
    }
    throw new RangeError(`Could not locate Meskerem 1 for Ethiopian year ${year}`);
  }

  function getYearLength(ethiopianYear) {
    const year = Number(ethiopianYear);
    if (!yearLengthCache.has(year)) {
      yearLengthCache.set(year, diffDays(findYearStart(year), findYearStart(year + 1)));
    }
    return yearLengthCache.get(year);
  }

  function getMonthLength(ethiopianYear, month) {
    const numericMonth = Number(month);
    if (!Number.isInteger(numericMonth) || numericMonth < 1 || numericMonth > 13) {
      throw new RangeError('Ethiopian month must be from 1 to 13');
    }
    return numericMonth <= 12 ? 30 : getYearLength(ethiopianYear) - 360;
  }

  function ethiopianToGregorian(year, month, day) {
    const numericYear = Number(year);
    const numericMonth = Number(month);
    const numericDay = Number(day);
    const monthLength = getMonthLength(numericYear, numericMonth);
    if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > monthLength) {
      throw new RangeError(`Day must be from 1 to ${monthLength} for this Ethiopian month`);
    }
    return addDays(findYearStart(numericYear), (numericMonth - 1) * 30 + numericDay - 1);
  }

  function getMonthNames(language = 'am') {
    return [...MONTHS[language === 'en' ? 'en' : 'am']];
  }

  function getWeekdayNames(language = 'am') {
    return [...WEEKDAYS[language === 'en' ? 'en' : 'am']];
  }

  function formatEthiopian(date, language = 'am') {
    const value = atNoon(date);
    const { year, month, day } = getEthiopianParts(value);
    const lang = language === 'en' ? 'en' : 'am';
    const era = lang === 'am' ? 'ዓ.ም.' : 'E.C.';
    return `${WEEKDAYS[lang][value.getDay()]} — ${MONTHS[lang][month - 1]} ${day} — ${year} ${era}`;
  }

  function formatEthiopianShort(date, language = 'am') {
    const { year, month, day } = getEthiopianParts(date);
    const lang = language === 'en' ? 'en' : 'am';
    const era = lang === 'am' ? 'ዓ.ም.' : 'E.C.';
    return `${MONTHS[lang][month - 1]} ${day}, ${year} ${era}`;
  }

  function formatGregorian(date, locale) {
    return new Intl.DateTimeFormat(locale || undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(atNoon(date));
  }

  function mondayIndex(date) {
    return (atNoon(date).getDay() + 6) % 7;
  }

  function startOfWeek(date) {
    return addDays(date, -mondayIndex(date));
  }

  function getYearProgress(date = new Date()) {
    const instant = new Date(date);
    if (Number.isNaN(instant.getTime())) throw new RangeError('Invalid date');
    const day = atNoon(instant);
    const parts = getEthiopianParts(day);
    const start = findYearStart(parts.year);
    const nextStart = findYearStart(parts.year + 1);
    const totalDays = diffDays(start, nextStart);
    const dayIndex = diffDays(start, day);
    const secondsIntoDay =
      instant.getHours() * 3600 +
      instant.getMinutes() * 60 +
      instant.getSeconds() +
      instant.getMilliseconds() / 1000;
    const fraction = secondsIntoDay / 86_400;
    const percent = Math.max(0, Math.min(100, ((dayIndex + fraction) / totalDays) * 100));

    const nextYearMidnight = new Date(
      nextStart.getFullYear(),
      nextStart.getMonth(),
      nextStart.getDate(),
      0,
      0,
      0,
      0
    );

    return {
      ethiopianYear: parts.year,
      totalDays,
      dayIndex,
      dayNumber: dayIndex + 1,
      daysLeft: totalDays - dayIndex,
      percent,
      start,
      nextStart,
      nextYearMidnight,
      millisecondsLeft: Math.max(0, nextYearMidnight.getTime() - instant.getTime())
    };
  }

  return Object.freeze({
    DAY_MS,
    addDays,
    atNoon,
    compareDays,
    diffDays,
    ethiopianToGregorian,
    findYearStart,
    formatEthiopian,
    formatEthiopianShort,
    formatGregorian,
    fromISODate,
    getEthiopianParts,
    getMonthLength,
    getMonthNames,
    getWeekdayNames,
    getYearLength,
    getYearProgress,
    mondayIndex,
    startOfWeek,
    today,
    toISODate
  });
});
