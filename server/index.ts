import { createServer } from "node:http";
import { attachChamber } from "./chamber";

const PORT = Number(process.env.SOCKET_PORT ?? 3001);
const ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

const httpServer = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: true, service: "gaming-government-chamber" }));
});

attachChamber(httpServer, { corsOrigin: ORIGIN });

httpServer.listen(PORT, () => {
  console.log(`Gaming Government chamber server on :${PORT}`);
});
