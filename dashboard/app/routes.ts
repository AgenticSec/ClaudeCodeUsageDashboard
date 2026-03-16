import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  // Dashboard
  index("routes/home.tsx"),

  // Ingest API
  route("api/v1/usage/ingest", "routes/api.v1.usage.ingest.ts"),
] satisfies RouteConfig;
