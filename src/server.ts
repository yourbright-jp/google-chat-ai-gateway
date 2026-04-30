import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";

const config = loadConfig();

serve(
  {
    fetch: createApp({ config }).fetch,
    port: config.port,
  },
  (info) => {
    console.log(`Google Chat AI Gateway listening on ${info.port}`);
  },
);
