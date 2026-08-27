const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export type ZonedDateParts = {
  weekday: number;
  hour: number;
  minute: number;
  dateKey: string;
};

function zonedPartsFromTimezone(timezone: string, date: Date): ZonedDateParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  const weekdayLabel = get("weekday");
  let hour = Number.parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;

  return {
    weekday: WEEKDAY_TO_INDEX[weekdayLabel] ?? 0,
    hour,
    minute: Number.parseInt(get("minute"), 10),
    dateKey: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

export function getZonedDateParts(timezone: string, date = new Date()): ZonedDateParts {
  try {
    return zonedPartsFromTimezone(timezone, date);
  } catch {
    return zonedPartsFromTimezone("UTC", date);
  }
}

export function isValidIanaTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function buildReminderSlotKey(dateKey: string, hour: number, minute: number): string {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${dateKey}T${hh}:${mm}`;
}

/** Minutes after the scheduled time during which a missed tick can still send. */
export const WORKOUT_REMINDER_CATCH_UP_MINUTES = 60;

export type ReminderSendInput = {
  hour: number;
  minute: number;
  days: number[];
  timezone: string;
  createdAt: Date;
  lastSentSlot: string | null;
};

/**
 * Send when the zoned clock is on the scheduled minute, or up to
 * WORKOUT_REMINDER_CATCH_UP_MINUTES late the same allowed day.
 * lastSentSlot prevents a second send for the same date+time slot.
 */
export function shouldSendReminder(
  reminder: ReminderSendInput,
  now = new Date(),
  catchUpMinutes = WORKOUT_REMINDER_CATCH_UP_MINUTES,
): { send: boolean; slotKey?: string } {
  const zoned = getZonedDateParts(reminder.timezone, now);

  if (reminder.days.length === 0) {
    const createdZoned = getZonedDateParts(reminder.timezone, reminder.createdAt);
    if (createdZoned.dateKey !== zoned.dateKey) {
      return { send: false };
    }
  } else if (!reminder.days.includes(zoned.weekday)) {
    return { send: false };
  }

  const slotKey = buildReminderSlotKey(zoned.dateKey, reminder.hour, reminder.minute);
  if (reminder.lastSentSlot === slotKey) {
    return { send: false };
  }

  const nowMinutes = zoned.hour * 60 + zoned.minute;
  const targetMinutes = reminder.hour * 60 + reminder.minute;
  const elapsed = nowMinutes - targetMinutes;
  if (elapsed < 0 || elapsed > catchUpMinutes) {
    return { send: false };
  }

  return { send: true, slotKey };
}

function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return { year, month, day };
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const { year, month, day } = parseDateKey(dateKey);
  const utc = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekdayForDateKey(timezone: string, dateKey: string): number {
  const { year, month, day } = parseDateKey(dateKey);
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return getZonedDateParts(timezone, probe).weekday;
}

export function computeNextReminderRun(
  reminder: {
    hour: number;
    minute: number;
    days: number[];
    enabled: boolean;
    timezone: string;
    createdAt: Date;
  },
  from = new Date(),
): string | null {
  if (!reminder.enabled) return null;

  const nowZoned = getZonedDateParts(reminder.timezone, from);
  const nowMinutes = nowZoned.hour * 60 + nowZoned.minute;
  const targetMinutes = reminder.hour * 60 + reminder.minute;

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const dateKey = addDaysToDateKey(nowZoned.dateKey, dayOffset);
    const weekday = weekdayForDateKey(reminder.timezone, dateKey);

    const dayAllowed =
      reminder.days.length === 0
        ? getZonedDateParts(reminder.timezone, reminder.createdAt).dateKey === dateKey
        : reminder.days.includes(weekday);

    if (!dayAllowed) continue;
    if (dayOffset === 0 && nowMinutes >= targetMinutes) continue;

    return buildReminderSlotKey(dateKey, reminder.hour, reminder.minute);
  }

  return null;
}

export function formatReminderSchedule(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function formatNextRunLabel(slotKey: string): string {
  const [datePart, timePart] = slotKey.split("T");
  if (!datePart || !timePart) return slotKey;
  const { year, month, day } = parseDateKey(datePart);
  const date = new Date(year, month - 1, day);
  const monthLabel = date.toLocaleString("en-US", { month: "short" });
  return `${monthLabel} ${day}, ${timePart}`;
}

export function isReminderDueWithinHours(
  reminder: {
    hour: number;
    minute: number;
    days: number[];
    enabled: boolean;
    timezone: string;
    createdAt: Date;
  },
  hours: number,
  from = new Date(),
): boolean {
  const next = computeNextReminderRun(reminder, from);
  if (!next) return false;
  const nextDate = new Date(next.replace("T", " ") + ":00");
  const diffMs = nextDate.getTime() - from.getTime();
  return diffMs >= 0 && diffMs <= hours * 60 * 60 * 1000;
}
