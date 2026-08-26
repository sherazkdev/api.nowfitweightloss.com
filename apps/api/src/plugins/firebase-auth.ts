import type { FastifyReply, FastifyRequest } from "fastify";
import { isFirebaseConfigured, verifyFirebaseIdToken } from "@weightloss/firebase";
import { getBearerToken } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    firebaseUid?: string;
  }
}

function unauthorized(reply: FastifyReply, message: string) {
  return reply.status(401).send({
    success: false,
    message,
  });
}

function serviceUnavailable(reply: FastifyReply) {
  return reply.status(503).send({
    success: false,
    message: "Workout reminders service is not configured.",
  });
}

export async function requireFirebaseAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!isFirebaseConfigured(request.server.env)) {
    return serviceUnavailable(reply);
  }

  const token = getBearerToken(request);
  if (!token) {
    return unauthorized(reply, "Sign in required to manage reminders.");
  }

  const user = await verifyFirebaseIdToken(request.server.env, token);
  if (!user) {
    return unauthorized(reply, "Invalid or expired Firebase token.");
  }

  request.firebaseUid = user.uid;
}
