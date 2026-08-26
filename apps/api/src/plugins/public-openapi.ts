import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "@weightloss/config";
import { buildPublicV1OpenApi } from "../openapi/public-v1.js";
import { SWAGGER_AUTH_THEME_CSS, SWAGGER_AUTH_THEME_JS } from "./swagger-auth-theme.js";
import { SWAGGER_PUBLIC_THEME_CSS, SWAGGER_PUBLIC_THEME_JS } from "./swagger-public-theme.js";

export async function registerPublicOpenApi(app: FastifyInstance, env: AppEnv) {
  const spec = buildPublicV1OpenApi(env);

  app.get("/api/v1/openapi.json", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
    return reply.send(spec);
  });

  if (!env.API_DOCS_ENABLED) return;

  await app.register(
    async (scope) => {
      await scope.register(swagger, {
        mode: "static",
        specification: { document: spec as never },
      });
      await scope.register(swaggerUi, {
        routePrefix: "/docs/public",
        uiConfig: {
          docExpansion: "list",
          deepLinking: true,
          tryItOutEnabled: true,
          persistAuthorization: true,
          filter: true,
          displayRequestDuration: true,
          supportedSubmitMethods: ["get", "post", "put", "patch", "delete"],
        },
        theme: {
          title: "WeightLoss Public API",
          css: [
            { filename: "auth-panel.css", content: SWAGGER_AUTH_THEME_CSS },
            { filename: "lang-panel.css", content: SWAGGER_PUBLIC_THEME_CSS },
          ],
          js: [
            { filename: "auth-panel.js", content: SWAGGER_AUTH_THEME_JS },
            { filename: "lang-panel.js", content: SWAGGER_PUBLIC_THEME_JS },
          ],
        },
      });
    },
    { prefix: "" },
  );
}
