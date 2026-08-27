import assert from "node:assert/strict";
import type { WorkoutReminderDocument } from "@weightloss/contracts";
import { shouldSendReminder } from "@weightloss/shared";

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
const mondayLate = new Date("2026-08-24T03:15:00.000Z");
const mondayTooLate = new Date("2026-08-24T04:01:00.000Z");
const mondayEarly = new Date("2026-08-24T02:59:00.000Z");

assert.equal(
  shouldSendReminder(baseReminder(), mondayMorning).send,
  true,
  "weekday match at scheduled time",
);

assert.equal(
  shouldSendReminder(baseReminder(), mondayLate).send,
  true,
  "catch-up window still sends 15 minutes late",
);

assert.equal(
  shouldSendReminder(baseReminder(), mondayTooLate).send,
  false,
  "more than 60 minutes late should not send",
);

assert.equal(
  shouldSendReminder(baseReminder(), mondayEarly).send,
  false,
  "before scheduled time should not send",
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
  shouldSendReminder(baseReminder({ lastSentSlot: first.slotKey! }), mondayLate).send,
  false,
  "duplicate slot should not resend even during catch-up",
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
