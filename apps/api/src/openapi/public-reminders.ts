const firebaseSecurity = [{ FirebaseBearer: [] }];

const reminderBody = {
  type: "object",
  required: ["hour", "minute", "days", "gender", "timezone"],
  properties: {
    hour: { type: "integer", minimum: 0, maximum: 23, example: 7, description: "Local hour (0–23)" },
    minute: { type: "integer", minimum: 0, maximum: 59, example: 0, description: "Local minute (0–59)" },
    days: {
      type: "array",
      items: { type: "integer", minimum: 0, maximum: 6 },
      example: [1, 2, 3, 4, 5],
      description: "Weekdays to fire: 0=Sun … 6=Sat. Empty array = one-shot on the created local date only.",
    },
    enabled: { type: "boolean", default: true, example: true },
    gender: { type: "string", enum: ["male", "female"], example: "male" },
    timezone: {
      type: "string",
      example: "Asia/Karachi",
      description: "IANA timezone, e.g. Asia/Karachi or America/New_York",
    },
  },
};

const reminderObject = {
  type: "object",
  properties: {
    id: { type: "integer", example: 1 },
    hour: { type: "integer", example: 7 },
    minute: { type: "integer", example: 0 },
    days: { type: "array", items: { type: "integer" }, example: [1, 2, 3, 4, 5] },
    enabled: { type: "boolean", example: true },
    gender: { type: "string", enum: ["male", "female"], example: "male" },
    timezone: { type: "string", example: "Asia/Karachi" },
  },
};

const reminderOk = {
  "200": {
    description: "Reminder payload",
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            success: { type: "boolean", enum: [true] },
            data: reminderObject,
          },
        },
      },
    },
  },
  "401": { description: "Missing or invalid Firebase ID token" },
  "404": { description: "Reminder not found for this user" },
  "422": { description: "Validation error" },
  "503": { description: "Firebase is not configured on the server" },
};

const idParam = {
  name: "id",
  in: "path" as const,
  required: true,
  schema: { type: "integer", minimum: 1 },
  description: "Reminder id",
};

export const PUBLIC_REMINDER_TAGS = [
  {
    name: "Reminders",
    description: "Mobile workout reminders. Authorize with a Firebase ID token (not admin JWT / x-api-key).",
  },
  {
    name: "Devices",
    description: "Register/unregister FCM tokens so reminder pushes can be delivered.",
  },
];

export function publicReminderPaths() {
  return {
    "/api/v1/workout-reminders": {
      get: {
        tags: ["Reminders"],
        summary: "List my workout reminders",
        description: "Returns reminders for the signed-in Firebase user, filtered by gender.",
        security: firebaseSecurity,
        parameters: [
          {
            name: "gender",
            in: "query",
            required: true,
            schema: { type: "string", enum: ["male", "female"] },
            description: "Required. male or female.",
            example: "male",
          },
        ],
        responses: {
          "200": {
            description: "Reminder array",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    data: { type: "array", items: reminderObject },
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid Firebase ID token" },
          "422": { description: "gender missing or invalid" },
          "503": { description: "Firebase is not configured on the server" },
        },
      },
      post: {
        tags: ["Reminders"],
        summary: "Create workout reminder",
        security: firebaseSecurity,
        requestBody: {
          required: true,
          content: { "application/json": { schema: reminderBody } },
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    success: { type: "boolean", enum: [true] },
                    data: reminderObject,
                  },
                },
              },
            },
          },
          "401": { description: "Missing or invalid Firebase ID token" },
          "422": { description: "Validation error" },
          "503": { description: "Firebase is not configured on the server" },
        },
      },
    },
    "/api/v1/workout-reminders/{id}": {
      put: {
        tags: ["Reminders"],
        summary: "Update workout reminder",
        security: firebaseSecurity,
        parameters: [idParam],
        requestBody: {
          required: true,
          content: { "application/json": { schema: reminderBody } },
        },
        responses: reminderOk,
      },
      delete: {
        tags: ["Reminders"],
        summary: "Delete workout reminder",
        security: firebaseSecurity,
        parameters: [idParam],
        responses: {
          "200": { description: "Deleted" },
          "401": { description: "Missing or invalid Firebase ID token" },
          "404": { description: "Reminder not found" },
          "422": { description: "Invalid id" },
          "503": { description: "Firebase is not configured on the server" },
        },
      },
    },
    "/api/v1/workout-reminders/{id}/toggle": {
      patch: {
        tags: ["Reminders"],
        summary: "Enable or pause a reminder",
        security: firebaseSecurity,
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["enabled"],
                properties: { enabled: { type: "boolean", example: true } },
              },
            },
          },
        },
        responses: reminderOk,
      },
    },
    "/api/v1/devices": {
      post: {
        tags: ["Devices"],
        summary: "Register FCM device token",
        description: "Call after login / token refresh so workout reminder pushes can reach this device.",
        security: firebaseSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fcm_token", "platform"],
                properties: {
                  fcm_token: { type: "string", example: "fcm-device-token" },
                  platform: { type: "string", enum: ["android", "ios"], example: "android" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Device registered" },
          "401": { description: "Missing or invalid Firebase ID token" },
          "422": { description: "Validation error" },
          "503": { description: "Firebase is not configured on the server" },
        },
      },
      delete: {
        tags: ["Devices"],
        summary: "Unregister FCM device token",
        description: "Send JSON body with fcm_token (not a query param).",
        security: firebaseSecurity,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["fcm_token"],
                properties: {
                  fcm_token: { type: "string", example: "fcm-device-token" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Device unregistered" },
          "401": { description: "Missing or invalid Firebase ID token" },
          "422": { description: "Validation error" },
          "503": { description: "Firebase is not configured on the server" },
        },
      },
    },
  };
}
