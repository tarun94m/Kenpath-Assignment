// Integration tests for the whole API. They create their own TST-* applications in Postgres and delete them afterwards,
// so demo data is untouched.   Run with the server AND database up:   npm test
// Optional live AI test (slow, needs Ollama):   $env:RUN_AI=1; npm test
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { TAG_KN, ALLOWED } from "../prompts.js";

const API = process.env.API || "http://127.0.0.1:4000";
const db = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL || "postgres://postgres:pw@127.0.0.1:5439/sandhya",
});
const PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const call = async (path, token, method = "GET", body) => {
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
  } catch {
    /* not JSON */
  }
  return { status: r.status, json, res: r };
};
const T = {}; // tokens
const act = (id, who, action, extra = {}) =>
  call(`/api/applications/${id}/action`, T[who], "POST", { action, ...extra });
const detail = async (id, who = "tah") =>
  (await call(`/api/applications/${id}`, T[who])).json;
const queue = async (who) =>
  (await call("/api/applications", T[who])).json.map((a) => a.id);

let n = 0;
const mk = async (o = {}) => {
  const a = {
    stage: 1,
    status: "pending",
    age: 70,
    income: 10000,
    bpl: true,
    docs: { a: true, i: true, b: true, p: true },
    phone: "9000012345",
    ...o,
  };
  const {
    rows: [r],
  } = await db.query(
    `INSERT INTO applications (ref_no,name,age,village,income,bpl,docs,stage,status,submitted_at,due_at,phone)
     VALUES ($1,'ಪರೀಕ್ಷಕ',$2,'ಪರೀಕ್ಷೆ',$3,$4,$5,$6,$7,CURRENT_DATE-5,CURRENT_DATE+10,$8) RETURNING id, ref_no`,
    [
      `TST-${Date.now()}-${++n}`,
      a.age,
      a.income,
      a.bpl,
      a.docs,
      a.stage,
      a.status,
      a.phone,
    ],
  );
  return r;
};
const clean = async () => {
  const ids = `(SELECT id FROM applications WHERE ref_no LIKE 'TST-%')`;
  const skipMissing = async (sql) => {
    try {
      await db.query(sql);
    } catch (e) {
      if (e.code !== "42P01") throw e;
    }
  }; // table not created yet: nothing to clean
  for (const t of ["ai_log", "notifications", "documents", "history"])
    await skipMissing(`DELETE FROM ${t} WHERE application_id IN ${ids}`);
  await skipMissing(`DELETE FROM applications WHERE ref_no LIKE 'TST-%'`);
};

before(async () => {
  // Log in first: the running server creates the extra tables on start-up, so it must have been started at least once.
  for (const [k, u] of [
    ["gao", "gao1"],
    ["ri", "ri1"],
    ["tah", "tah1"],
  ]) {
    let r;
    try {
      r = await call("/api/login", null, "POST", {
        username: u,
        password: "demo123",
      });
    } catch {
      assert.fail(
        `Cannot reach the API at ${API}. Start it in another terminal with "npm start" and wait for "API on :4000", then run the tests again.`,
      );
    }
    assert.equal(
      r.status,
      200,
      `cannot log in as ${u} (status ${r.status}): has the server finished starting?`,
    );
    T[k] = r.json.token;
  }
  await clean();
});
after(async () => {
  await clean();
  await db.end();
});

describe("Auth", () => {
  test("no token -> 401", async () =>
    assert.equal((await call("/api/applications")).status, 401));
  test("wrong password -> 401", async () =>
    assert.equal(
      (
        await call("/api/login", null, "POST", {
          username: "gao1",
          password: "nope",
        })
      ).status,
      401,
    ));
  test("unknown user -> 401", async () =>
    assert.equal(
      (
        await call("/api/login", null, "POST", {
          username: "ghost",
          password: "demo123",
        })
      ).status,
      401,
    ));
  test("tampered token -> 401", async () =>
    assert.equal((await call("/api/applications", T.gao + "x")).status, 401));
  test("login returns name and role, never the password hash", async () => {
    const r = await call("/api/login", null, "POST", {
      username: "ri1",
      password: "demo123",
    });
    assert.equal(r.json.user.role, "ri");
    assert.ok(r.json.user.name);
    assert.equal(r.json.user.pw, undefined);
  });
});

describe("Queues and permissions", () => {
  test("each officer sees their own step; the Tahsildar sees all open files", async () => {
    const s1 = await mk({ stage: 1 }),
      s2 = await mk({ stage: 2 }),
      s3 = await mk({ stage: 3 });
    const [g, r, t] = [
      await queue("gao"),
      await queue("ri"),
      await queue("tah"),
    ];
    assert.ok(g.includes(s1.id) && !g.includes(s2.id) && !g.includes(s3.id));
    assert.ok(r.includes(s2.id) && !r.includes(s1.id) && !r.includes(s3.id));
    assert.ok([s1, s2, s3].every((x) => t.includes(x.id)));
  });
  test("returned files go back to the first officer only (and the Tahsildar)", async () => {
    const a = await mk({ stage: 1, status: "returned" });
    assert.ok((await queue("gao")).includes(a.id));
    assert.ok(!(await queue("ri")).includes(a.id));
    assert.ok((await queue("tah")).includes(a.id));
  });
  test("closed files are visible to everyone", async () => {
    const a = await mk({ stage: 3, status: "approved" });
    for (const w of ["gao", "ri", "tah"])
      assert.ok((await queue(w)).includes(a.id));
  });
  test("can_act is true only for the officer who owns the step", async () => {
    const a = await mk({ stage: 2 });
    assert.equal((await detail(a.id, "ri")).can_act, true);
    assert.equal((await detail(a.id, "gao")).can_act, false);
    assert.equal((await detail(a.id, "tah")).can_act, false);
  });
  test("acting on another officer's step -> 403 (action, photo upload, photo confirm)", async () => {
    const a = await mk({ stage: 1 });
    assert.equal((await act(a.id, "ri", "advance")).status, 403);
    assert.equal((await act(a.id, "tah", "approve")).status, 403);
    assert.equal(
      (
        await call(`/api/applications/${a.id}/documents`, T.ri, "POST", {
          kind: "p",
          image: PNG,
        })
      ).status,
      403,
    );
    await call(`/api/applications/${a.id}/documents`, T.gao, "POST", {
      kind: "p",
      image: PNG,
    });
    const doc = (await detail(a.id, "gao")).photos[0];
    assert.equal(
      (await call(`/api/documents/${doc.id}/confirm`, T.ri, "POST", {})).status,
      403,
    );
  });
  test("dashboard: only the Tahsildar", async () => {
    assert.equal((await call("/api/dashboard", T.gao)).status, 403);
    assert.equal((await call("/api/dashboard", T.ri)).status, 403);
    assert.equal((await call("/api/dashboard", T.tah)).status, 200);
  });
  test("unknown application -> 404", async () =>
    assert.equal(
      (await call("/api/applications/99999999", T.tah)).status,
      404,
    ));
});

describe("Eligibility checks (rules, not AI)", () => {
  test("a complete, eligible file passes every check", async () => {
    const a = await mk();
    assert.ok((await detail(a.id)).checks.every((c) => c.ok));
  });
  test("age, income, BPL and missing documents each fail on their own", async () => {
    const a = await mk({
      age: 63,
      income: 45000,
      bpl: false,
      docs: { a: true, i: true, b: false, p: false },
    });
    const bad = (await detail(a.id)).checks
      .filter((c) => !c.ok)
      .map((c) => c.k)
      .sort();
    assert.deepEqual(bad, ["age", "bpl", "d_b", "d_p", "income"]);
  });
  test("boundaries: age 65 and income 20000 are eligible", async () => {
    const a = await mk({ age: 65, income: 20000 });
    assert.ok((await detail(a.id)).checks.every((c) => c.ok));
  });
  test("the list reports how many checks failed", async () => {
    const a = await mk({ age: 60 });
    const row = (await call("/api/applications", T.tah)).json.find(
      (x) => x.id === a.id,
    );
    assert.equal(row.failed, 1);
  });
});

describe("Workflow", () => {
  test("full path: step 1 -> 2 -> 3 -> approved, history names each officer", async () => {
    const a = await mk();
    assert.equal((await act(a.id, "gao", "advance")).status, 200);
    assert.equal(
      (await act(a.id, "ri", "advance", { fieldNotes: "ಮನೆಯಲ್ಲೇ ವಾಸ" })).status,
      200,
    );
    assert.equal((await act(a.id, "tah", "approve")).status, 200);
    const d = await detail(a.id);
    assert.equal(d.status, "approved");
    assert.deepEqual(d.history.map((h) => h.action).reverse(), [
      "advance",
      "advance",
      "approve",
    ]);
    assert.deepEqual(d.history.map((h) => h.role).reverse(), [
      "gao",
      "ri",
      "tahsildar",
    ]);
    assert.ok(d.history.every((h) => h.user_name));
    assert.equal(d.field_notes, "ಮನೆಯಲ್ಲೇ ವಾಸ");
  });
  test("step 2 cannot advance without field notes", async () => {
    const a = await mk({ stage: 2 });
    const r = await act(a.id, "ri", "advance");
    assert.equal(r.status, 400);
    assert.equal(r.json.error, "field notes required");
    assert.equal((await detail(a.id)).stage, 2);
  });
  test('step 3 cannot "advance"; approve is only allowed at step 3', async () => {
    const s3 = await mk({ stage: 3 }),
      s1 = await mk({ stage: 1 });
    assert.equal((await act(s3.id, "tah", "advance")).status, 400);
    assert.equal((await act(s1.id, "gao", "approve")).status, 400);
  });
  test("reject and return need a written reason", async () => {
    const a = await mk({ stage: 3 });
    assert.equal((await act(a.id, "tah", "reject")).status, 400);
    assert.equal(
      (await act(a.id, "tah", "reject", { remark: "   " })).status,
      400,
    );
    assert.equal((await act(a.id, "tah", "return")).status, 400);
    assert.equal(
      (await act(a.id, "tah", "reject", { remark: "ಆದಾಯ ಹೆಚ್ಚು" })).status,
      200,
    );
    assert.equal((await detail(a.id)).status, "rejected");
  });
  test("an unknown action is refused", async () => {
    const a = await mk();
    assert.equal((await act(a.id, "gao", "explode")).status, 400);
  });
  test("closed files cannot be changed again", async () => {
    const a = await mk({ stage: 3 });
    await act(a.id, "tah", "approve");
    assert.equal(
      (await act(a.id, "tah", "reject", { remark: "x" })).status,
      403,
    );
    assert.equal((await detail(a.id)).status, "approved");
  });
  test("return -> reopen puts the file back at step 1 with a fresh deadline", async () => {
    const a = await mk({ stage: 2 });
    await act(a.id, "ri", "return", { remark: "ಪಾಸ್‌ಬುಕ್ ಇಲ್ಲ" });
    let d = await detail(a.id, "gao");
    assert.equal(d.status, "returned");
    assert.equal(d.can_act, true);
    assert.equal((await act(a.id, "gao", "reopen")).status, 200);
    d = await detail(a.id, "gao");
    assert.equal(d.status, "pending");
    assert.equal(d.stage, 1);
    assert.ok(d.days_left >= 29);
  });
  test("reopen is refused for a file that was not returned", async () => {
    const a = await mk();
    assert.equal((await act(a.id, "gao", "reopen")).status, 409);
  });
  test("history is newest-first and records the reason", async () => {
    const a = await mk({ stage: 3 });
    await act(a.id, "tah", "return", { remark: "ಕಾರಣ-ಪರೀಕ್ಷೆ" });
    const h = (await detail(a.id)).history;
    assert.equal(h[0].action, "return");
    assert.equal(h[0].remark, "ಕಾರಣ-ಪರೀಕ್ಷೆ");
  });
});

describe("Document photos", () => {
  test("rejects an unknown document type and a non-image", async () => {
    const a = await mk();
    assert.equal(
      (
        await call(`/api/applications/${a.id}/documents`, T.gao, "POST", {
          kind: "z",
          image: PNG,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(`/api/applications/${a.id}/documents`, T.gao, "POST", {
          kind: "p",
          image: "hello",
        })
      ).status,
      400,
    );
  });
  test("a photo fills the checklist, and the file cannot move on until it is confirmed", async () => {
    const a = await mk({ docs: { a: true, i: true, b: true, p: false } });
    assert.equal(
      (await detail(a.id)).checks.find((c) => c.k === "d_p").ok,
      false,
    );
    assert.equal(
      (
        await call(`/api/applications/${a.id}/documents`, T.gao, "POST", {
          kind: "p",
          image: PNG,
        })
      ).status,
      200,
    );
    let d = await detail(a.id, "gao");
    assert.equal(d.checks.find((c) => c.k === "d_p").ok, true);
    assert.equal(d.photos.length, 1);
    assert.equal(d.photos[0].confirmed, false);
    const blocked = await act(a.id, "gao", "advance");
    assert.equal(blocked.status, 400);
    assert.equal(blocked.json.error, "confirm documents");
    assert.equal(
      (
        await call(
          `/api/documents/${d.photos[0].id}/confirm`,
          T.gao,
          "POST",
          {},
        )
      ).status,
      200,
    );
    assert.equal((await act(a.id, "gao", "advance")).status, 200);
  });
  test("retaking a photo replaces it (one photo per document type)", async () => {
    const a = await mk();
    for (let i = 0; i < 2; i++)
      await call(`/api/applications/${a.id}/documents`, T.gao, "POST", {
        kind: "p",
        image: PNG,
      });
    assert.equal((await detail(a.id, "gao")).photos.length, 1);
  });
  test("photos can only be added at step 1", async () => {
    const a = await mk({ stage: 2 });
    assert.equal(
      (
        await call(`/api/applications/${a.id}/documents`, T.ri, "POST", {
          kind: "p",
          image: PNG,
        })
      ).status,
      403,
    );
  });
});

describe("Applicant messages", () => {
  test("a Kannada message is created at receipt, return and approval", async () => {
    const a = await mk();
    await act(a.id, "gao", "advance");
    await act(a.id, "ri", "return", { remark: "ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್ ತನ್ನಿ" });
    const b = await mk({ stage: 3 });
    await act(b.id, "tah", "approve");
    const na = (await detail(a.id)).notes,
      nb = (await detail(b.id)).notes;
    assert.equal(na.length, 2);
    assert.ok(
      na.every((m) => m.body.includes("ನಮಸ್ಕಾರ") && m.body.includes(a.ref_no)),
    );
    assert.ok(na.some((m) => m.body.includes("ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್ ತನ್ನಿ")));
    assert.ok(nb[0].body.includes("ಮಂಜೂರಾಗಿದೆ"));
    assert.ok(
      [...na, ...nb].every((m) =>
        ["queued", "sent", "failed"].includes(m.status),
      ),
    );
  });
  test("a rejection message carries the reason", async () => {
    const a = await mk({ stage: 3 });
    await act(a.id, "tah", "reject", { remark: "ವಯಸ್ಸು ಕಡಿಮೆ" });
    assert.ok((await detail(a.id)).notes[0].body.includes("ವಯಸ್ಸು ಕಡಿಮೆ"));
  });
  test("no phone number -> no message, and the action still works", async () => {
    const a = await mk({ phone: null });
    assert.equal((await act(a.id, "gao", "advance")).status, 200);
    assert.equal((await detail(a.id)).notes.length, 0);
  });
  test("a plain step-2 -> step-3 move sends nothing", async () => {
    const a = await mk({ stage: 2 });
    await act(a.id, "ri", "advance", { fieldNotes: "ok" });
    assert.equal((await detail(a.id)).notes.length, 0);
  });
});

describe("AI suggestion log", () => {
  const logRow = async (appId, stage, suggestion) =>
    (
      await db.query(
        "INSERT INTO ai_log (application_id,stage,suggestion,text) VALUES ($1,$2,$3,$4) RETURNING id",
        [appId, stage, suggestion, "x"],
      )
    ).rows[0].id;
  const row = async (id) =>
    (
      await db.query(
        "SELECT final, agreed, decided_at FROM ai_log WHERE id=$1",
        [id],
      )
    ).rows[0];

  test("AI endpoint needs login", async () =>
    assert.equal(
      (await call("/api/applications/1/ai", null, "POST")).status,
      401,
    ));
  test("officer agrees with the AI -> agreed = true", async () => {
    const a = await mk({ stage: 3 }),
      id = await logRow(a.id, 3, "APPROVE");
    await act(a.id, "tah", "approve", { aiLogId: id });
    const r = await row(id);
    assert.equal(r.final, "APPROVE");
    assert.equal(r.agreed, true);
    assert.ok(r.decided_at);
  });
  test("officer overrides the AI -> agreed = false, shown on the dashboard", async () => {
    const a = await mk({ stage: 3 }),
      id = await logRow(a.id, 3, "APPROVE");
    await act(a.id, "tah", "reject", {
      aiLogId: id,
      remark: "ಕ್ಷೇತ್ರ ಪರಿಶೀಲನೆಯಲ್ಲಿ ತಪ್ಪು",
    });
    assert.equal((await row(id)).agreed, false);
    const dash = (await call("/api/dashboard", T.tah)).json;
    assert.ok(
      dash.ai_diff.some(
        (x) => x.suggestion === "APPROVE" && x.final === "REJECT",
      ),
    );
    assert.ok(dash.ai.find((s) => s.stage === 3).decided >= 1);
  });
  test("AI was used -> flagged in history", async () => {
    const a = await mk({ stage: 3 }),
      id = await logRow(a.id, 3, "APPROVE");
    await act(a.id, "tah", "approve", { aiLogId: id });
    assert.equal((await detail(a.id)).history[0].ai_used, true);
  });
  test("a log id from a different application is ignored", async () => {
    const a = await mk({ stage: 3 }),
      other = await mk({ stage: 3 }),
      id = await logRow(other.id, 3, "APPROVE");
    await act(a.id, "tah", "approve", { aiLogId: id });
    assert.equal((await row(id)).decided_at, null);
  });
  test("prompt tags are all defined in Kannada", () => {
    for (const tags of Object.values(ALLOWED))
      for (const t of tags)
        assert.ok(TAG_KN[t], `missing Kannada label for ${t}`);
  });
  test(
    "LIVE: the model answers (set RUN_AI=1)",
    { skip: !process.env.RUN_AI, timeout: 180000 },
    async () => {
      const a = await mk();
      const r = await call(`/api/applications/${a.id}/ai`, T.gao, "POST");
      assert.ok([200, 503].includes(r.status));
      if (r.status === 200) {
        assert.ok(r.res.headers.get("x-ai-log"));
        assert.ok((await r.res.text()).length > 0);
      }
    },
  );
});

describe("Dashboard and stats", () => {
  test("dashboard has every section with the right shape", async () => {
    await mk();
    await mk({ stage: 3, status: "approved" });
    const d = (await call("/api/dashboard", T.tah)).json;
    for (const k of [
      "kpi",
      "by_stage",
      "by_village",
      "returns",
      "outcomes",
      "ai",
      "ai_diff",
    ])
      assert.ok(k in d, k);
    for (const k of ["pending", "overdue", "closed"])
      assert.equal(typeof d.kpi[k], "number");
    assert.ok(d.by_village.some((v) => v.village === "ಪರೀಕ್ಷೆ"));
  });
  test("overdue files are counted", async () => {
    const before = (await call("/api/stats", T.tah)).json.overdue;
    const a = await mk();
    await db.query(
      "UPDATE applications SET due_at = CURRENT_DATE - 2 WHERE id=$1",
      [a.id],
    );
    assert.equal((await call("/api/stats", T.tah)).json.overdue, before + 1);
    const row = (await call("/api/applications", T.tah)).json.find(
      (x) => x.id === a.id,
    );
    assert.equal(row.days_left, -2);
  });
  test("open files are listed before closed ones, soonest deadline first", async () => {
    const closed = await mk({ status: "approved", stage: 3 }),
      soon = await mk(),
      later = await mk();
    await db.query(
      "UPDATE applications SET due_at = CURRENT_DATE + 1 WHERE id=$1",
      [soon.id],
    );
    await db.query(
      "UPDATE applications SET due_at = CURRENT_DATE + 20 WHERE id=$1",
      [later.id],
    );
    const ids = await queue("tah");
    assert.ok(
      ids.indexOf(soon.id) < ids.indexOf(later.id) &&
        ids.indexOf(later.id) < ids.indexOf(closed.id),
    );
  });
});
