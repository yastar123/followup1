import { createServer } from "vite";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function start() {
  console.log(`Starting server on ${HOST}:${PORT}...`);
  const server = await createServer({
    server: {
      port: PORT,
      host: HOST,
    },
  });

  await server.listen();
  console.log(`Server successfully listening on http://${HOST}:${PORT}`);
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
