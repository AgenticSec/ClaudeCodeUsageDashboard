/**
 * Cloudflare Workers entry point for React Router v7
 */

import { createRequestHandler } from "react-router";

// Import the server build
// @ts-expect-error - This will be bundled by wrangler
import * as serverBuild from "../build/server/index.js";

const requestHandler = createRequestHandler(serverBuild, "production");

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    try {
      return await requestHandler(request, {
        cloudflare: {
          env,
          ctx,
          caches,
        },
      });
    } catch (error) {
      console.error("Request handler error:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;
