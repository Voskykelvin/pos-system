const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || 'Africa/Nairobi';

function getParts(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return formatter.formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') {
      acc[part.type] = Number(part.value);
    }
    return acc;
  }, {});
}

function getOffsetMs(date, timeZone = BUSINESS_TIME_ZONE) {
  const parts = getParts(date, timeZone);
  const utcLike = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour === 24 ? 0 : parts.hour,
    parts.minute,
    parts.second
  );

  return utcLike - date.getTime();
}

function zonedMidnightToUtc({ year, month, day }, timeZone = BUSINESS_TIME_ZONE) {
  const utcLike = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const firstPass = new Date(utcLike - getOffsetMs(new Date(utcLike), timeZone));
  return new Date(utcLike - getOffsetMs(firstPass, timeZone));
}

function getBusinessDate(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const parts = getParts(date, timeZone);
  const yyyy = String(parts.year);
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');

  return {
    date: `${yyyy}-${mm}-${dd}`,
    compact: `${yyyy}${mm}${dd}`,
    year: parts.year,
    month: parts.month,
    day: parts.day,
    timeZone
  };
}

function getBusinessDayRange(date = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const businessDate = getBusinessDate(date, timeZone);
  const start = zonedMidnightToUtc(businessDate, timeZone);
  const nextDay = new Date(Date.UTC(
    businessDate.year,
    businessDate.month - 1,
    businessDate.day + 1
  ));
  const nextParts = getBusinessDate(nextDay, 'UTC');
  const end = zonedMidnightToUtc(nextParts, timeZone);

  return {
    start,
    end,
    businessDate: businessDate.date,
    timeZone
  };
}

module.exports = {
  BUSINESS_TIME_ZONE,
  getBusinessDate,
  getBusinessDayRange
};
