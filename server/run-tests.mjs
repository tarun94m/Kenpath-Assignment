// `npm test` helper: uses the API if it is already running, otherwise starts it, runs the tests, then stops it.
import { spawn } from "node:child_process";

const API = process.env.API || "http://127.0.0.1:4000";
const up = async () => {
  try {
    await fetch(`${API}/api/stats`);
    return true;
  } catch {
    return false;
  }
};

let server = null;
if (!(await up())) {
  console.log("API not running: starting it for the tests...");
  server = spawn(process.execPath, ["index.js"], {
    stdio: ["ignore", "inherit", "inherit"],
    env: process.env,
  });
  let exited = false;
  server.on("exit", () => {
    exited = true;
  });
  for (let i = 0; i < 60 && !exited && !(await up()); i++)
    await new Promise((r) => setTimeout(r, 500));
  if (exited || !(await up())) {
    console.error(
      "The server did not start (see the message above). Is the database running? Try: docker compose up -d",
    );
    process.exit(1);
  }
}

const tests = spawn(process.execPath, ["--test", "test/api.test.mjs"], {
  stdio: "inherit",
  env: process.env,
});
tests.on("exit", (code) => {
  server?.kill();
  process.exit(code ?? 1);
});
