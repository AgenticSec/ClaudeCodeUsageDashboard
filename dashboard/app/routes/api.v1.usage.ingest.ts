import type { Route } from "./+types/api.v1.usage.ingest";
import type { IngestPayload } from "~/lib/types";
import {
  upsertUser,
  checkSessionExists,
  insertSessionAndEvents,
} from "~/lib/db.server";

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  const db = context.cloudflare.env.DB;

  let payload: IngestPayload;
  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Validate required fields
  if (!payload.email || typeof payload.email !== "string") {
    return Response.json(
      { error: "Validation error: email is required" },
      { status: 400 }
    );
  }

  if (!payload.session || typeof payload.session !== "object") {
    return Response.json(
      { error: "Validation error: session object is required" },
      { status: 400 }
    );
  }

  const { session } = payload;
  if (!session.session_id || !session.model || !session.first_event_at || !session.last_event_at || !session.project_dir) {
    return Response.json(
      { error: "Validation error: session_id, model, project_dir, first_event_at, and last_event_at are required" },
      { status: 400 }
    );
  }

  try {
    // Upsert user
    const userId = await upsertUser(db, payload.email);

    // Check for duplicate session
    const exists = await checkSessionExists(db, session.session_id);
    if (exists) {
      return Response.json(
        { error: "Session already uploaded", session_id: session.session_id },
        { status: 409 }
      );
    }

    // Insert session and events
    const result = await insertSessionAndEvents(db, userId, payload);

    return Response.json({
      success: true,
      session_id: session.session_id,
      skill_events_inserted: result.skillEventsInserted,
      mcp_events_inserted: result.mcpEventsInserted,
      subagent_events_inserted: result.subagentEventsInserted,
    });
  } catch (error) {
    console.error("Ingest error:", error);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
