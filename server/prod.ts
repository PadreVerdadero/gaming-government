import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { attachChamber } from "./chamber";

const dev = process.env.NODE_ENV !== "production";
/** Bind all interfaces — do not use Docker/Railway HOSTNAME (container id). */
const listenHost = process.env.HOST ?? "0.0.0.0";
const port = Number(process.env.PORT ?? 3000);

async function main() {
  const app = next({ dev, hostname: listenHost, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true);
    void handle(req, res, parsedUrl);
  });

  attachChamber(httpServer, {
    corsOrigin: process.env.CLIENT_ORIGIN ?? true,
  });

  httpServer.listen(port, listenHost, () => {
    console.log(`Gaming Government listening on http://${listenHost}:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
