import assert from "node:assert/strict";
import type { WorkoutReminderDocument } from "@weightloss/contracts";
import { buildReminderSlotKey, getZonedDateParts } from "@weightloss/shared";

function shouldSendReminder(
  reminder: WorkoutReminderDocument,
  now = new Date(),
): { send: boolean; slotKey?: string } {
  const zoned = getZonedDateParts(reminder.timezone, now);
  if (zoned.hour !== reminder.hour || zoned.minute !== reminder.minute) {
    return { send: false };
  }

  const slotKey = buildReminderSlotKey(zoned.dateKey, reminder.hour, reminder.minute);

  if (reminder.days.length === 0) {
    const createdZoned = getZonedDateParts(reminder.timezone, reminder.createdAt);
    if (createdZoned.dateKey !== zoned.dateKey) {
      return { send: false };
    }
  } else if (!reminder.days.includes(zoned.weekday)) {
    return { send: false };
  }

  if (reminder.lastSentSlot === slotKey) {
    return { send: false };
  }

  return { send: true, slotKey };
}

function baseReminder(overrides: Partial<WorkoutReminderDocument> = {}): WorkoutReminderDocument {
  return {
    id: 1,
    firebaseUid: "uid-1",
    gender: "male",
    hour: 8,
    minute: 0,
    days: [1, 2, 3, 4, 5],
    enabled: true,
    timezone: "Asia/Karachi",
    lastSentSlot: null,
    createdAt: new Date("2026-08-25T03:00:00.000Z"),
    updatedAt: new Date("2026-08-25T03:00:00.000Z"),
    ...overrides,
  };
}

// Monday 08:00 Asia/Karachi
const mondayMorning = new Date("2026-08-24T03:00:00.000Z");

assert.equal(getZonedDateParts("Asia/Karachi", mondayMorning).weekday, 1);
assert.equal(
  shouldSendReminder(baseReminder(), mondayMorning).send,
  true,
  "weekday match at scheduled time",
);

assert.equal(
  shouldSendReminder(baseReminder({ days: [0] }), mondayMorning).send,
  false,
  "wrong weekday should not send",
);

assert.equal(
  shouldSendReminder(baseReminder({ hour: 9 }), mondayMorning).send,
  false,
  "wrong hour should not send",
);

const first = shouldSendReminder(baseReminder(), mondayMorning);
assert.equal(first.send, true);
assert.equal(
  shouldSendReminder(baseReminder({ lastSentSlot: first.slotKey! }), mondayMorning).send,
  false,
  "duplicate slot should not resend",
);

const emptyDaysCreated = new Date("2026-08-24T03:00:00.000Z");
assert.equal(
  shouldSendReminder(
    baseReminder({ days: [], createdAt: emptyDaysCreated }),
    emptyDaysCreated,
  ).send,
  true,
  "empty days sends once on creation day",
);

assert.equal(
  shouldSendReminder(
    baseReminder({ days: [], createdAt: emptyDaysCreated }),
    new Date("2026-08-25T03:00:00.000Z"),
  ).send,
  false,
  "empty days does not repeat next day",
);

console.log("reminder-logic-tests: all passed");
