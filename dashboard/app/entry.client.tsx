/**
 * Entry client - hydrates the React app in the browser
 */

import { hydrateRoot } from "react-dom/client";
import { HydratedRouter } from "react-router/dom";
import { startTransition } from "react";

startTransition(() => {
  hydrateRoot(document, <HydratedRouter />);
});
