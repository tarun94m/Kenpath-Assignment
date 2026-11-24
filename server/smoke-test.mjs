// Read-only end-to-end check of the running API. Run with the server up:  npm run smoke   (add --ai to also test Ollama, slow)
const API = process.env.API || "http://127.0.0.1:4000";
let failed = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  " + extra : ""}`);
  if (!cond) failed++;
};
const call = async (path, { token, method = "GET", body } = {}) => {
  const r = await fetch(API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body && JSON.stringify(body),
  });
  let json = null;
  try {
    json = await r.clone().json();
  } catch {}
  return { status: r.status, json, res: r };
};
const login = async (u) =>
  (
    await call("/api/login", {
      method: "POST",
      body: { username: u, password: "demo123" },
    })
  ).json?.token;

try {
  ok("no token -> 401", (await call("/api/applications")).status === 401);
  ok(
    "bad password -> 401",
    (
      await call("/api/login", {
        method: "POST",
        body: { username: "gao1", password: "x" },
      })
    ).status === 401,
  );
  const [g, r, t] = await Promise.all(["gao1", "ri1", "tah1"].map(login));
  ok("3 demo users can log in", !!(g && r && t));

  const q = async (tok) =>
    (await call("/api/applications", { token: tok })).json || [];
  const [qg, qr, qt] = [await q(g), await q(r), await q(t)];
  const open = (l) =>
    l.filter((a) => ["pending", "returned"].includes(a.status));
  ok(
    "gao1 queue is step 1 only",
    open(qg).every((a) => a.stage === 1 || a.status === "returned"),
    `(${open(qg).length} open)`,
  );
  ok(
    "ri1 queue is step 2 only",
    open(qr).every((a) => a.stage === 2),
    `(${open(qr).length} open)`,
  );
  ok(
    "tah1 sees every open file",
    open(qt).length >= open(qg).length + open(qr).length,
    `(${open(qt).length} open)`,
  );

  const first = open(qg)[0];
  if (first) {
    const d = (await call(`/api/applications/${first.id}`, { token: g })).json;
    ok(
      "detail has checks/history/photos/notes/can_act",
      d &&
        ["checks", "history", "photos", "notes", "can_act"].every(
          (k) => k in d,
        ) &&
        d.can_act === true,
    );
    ok(
      "wrong role cannot act -> 403",
      (
        await call(`/api/applications/${first.id}/action`, {
          token: r,
          method: "POST",
          body: { action: "advance" },
        })
      ).status === 403,
    );
    ok(
      "wrong role cannot upload photo -> 403",
      (
        await call(`/api/applications/${first.id}/documents`, {
          token: r,
          method: "POST",
          body: { kind: "a", image: "data:image/jpeg;base64,AAAA" },
        })
      ).status === 403,
    );
  } else console.log("SKIP  no open step-1 file for gao1 (all moved on?)");

  ok(
    "gao1 dashboard -> 403",
    (await call("/api/dashboard", { token: g })).status === 403,
  );
  const dash = await call("/api/dashboard", { token: t });
  ok(
    "tah1 dashboard -> 200 with data",
    dash.status === 200 && dash.json?.kpi && Array.isArray(dash.json?.ai),
    dash.status !== 200 ? JSON.stringify(dash.json) : "",
  );
  ok(
    "stats endpoint works",
    (await call("/api/stats", { token: t })).status === 200,
  );

  if (process.argv.includes("--ai") && first) {
    console.log("...asking the AI (can take 1-2 minutes the first time)");
    const a = await call(`/api/applications/${first.id}/ai`, {
      token: g,
      method: "POST",
    });
    const text = (await a.res.text()).slice(0, 160).replace(/\n/g, " | ");
    ok(
      "AI answers",
      a.status === 200 && text.length > 0,
      a.status === 200
        ? text
        : `status ${a.status}: see the "Ollama error:" line in the server terminal`,
    );
  }
} catch (e) {
  failed++;
  console.log(
    "FAIL  could not reach the API:",
    e.cause?.code || e.message,
    "- is `npm start` running on",
    API,
    "?",
  );
}
console.log(
  failed
    ? `\n${failed} check(s) failed. Paste this output and the server terminal output.`
    : "\nAll checks passed.",
);
process.exit(failed ? 1 : 0);
