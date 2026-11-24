# ಸಂಧ್ಯಾ ಸುರಕ್ಷಾ – Old-age pension workflow (Karnataka, Kannada)

**Problem.** Old-age pension (Sandhya Suraksha) applications move from the Nadakacheri/Grama One counter to the village-level
officer, then a Revenue Inspector's field visit, then the Tahsildar. Files wait in piles; nobody sees what is overdue;
documents are found missing only at the last step. Elderly applicants make repeat trips.

**Workflow (3 steps).** 1 Document check → 2 Field verification → 3 Decision (approve / reject / return).
Reject and return need a written reason. Return sends it back to the applicant; "reopen" restarts at step 1 with a fresh deadline.

**Where AI helps (Ollama, local - no citizen data leaves the server)**
1. Documents: Kannada summary of what is missing and what to ask the applicant to bring.
2. Field visit: five short yes/no questions to ask at the doorstep. Notes can be spoken (browser Kannada speech input).
3. Decision: a 3-line suggested note. Eligibility checks themselves are plain code, not AI, so they are never "hallucinated".
If Ollama is down the app still works; AI is advisory and the officer clicks every decision. Each history row records whether AI was used.

## Roles and dashboard
Three roles own the three steps: ಗ್ರಾಮ ಆಡಳಿತ ಅಧಿಕಾರಿ (`gao1`, step 1), ರಾಜಸ್ವ ನಿರೀಕ್ಷಕ (`ri1`, step 2), ತಹಶೀಲ್ದಾರ್ (`tah1`, step 3). Demo password: `demo123`.
Each officer sees their own queue and can act only on their step (enforced on the server, returns 403 otherwise); history records who did what.
The Tahsildar also sees every open file (read-only outside step 3) and the ಡ್ಯಾಶ್‌ಬೋರ್ಡ್: backlog, overdue, average days to decision, AI usage,
pending by step and village, and where files are returned. Set `SECRET` in production and replace the demo users.

## AI safety log and Kannada quality
- Every AI suggestion is stored in `ai_log` with model, prompt version and the officer's final action. At steps 1 and 3 the model's first line is a
  machine-readable outcome (CONTINUE / RETURN / REJECT / APPROVE) shown to the officer in Kannada; the dashboard reports how often the officer agreed, per step,
  and lists the latest disagreements: these are the cases to read when judging whether the model can be trusted. Step 2 (doorstep questions) logs no outcome.
- All model instructions are in `server/prompts.js` (rule failures are passed as Kannada sentences, with a preferred-vocabulary list).
- Default model is `gemma3:4b` (`ollama pull gemma3:4b`; try `gemma3:12b` if the machine allows). Before a pilot run `npm run review` in `server/`:
  it writes `review.md` with 8 sample cases; a Kannada speaker marks each output and corrects wording, then update `prompts.js` and bump `PROMPT_VERSION`.

## Document photos and applicant messages
- **Photos (step 1):** the officer photographs each document; a vision model (`VISION_MODEL`, default = `OLLAMA_MODEL`, `gemma3:4b` accepts images) reads name and birth year,
  mismatches with the form are flagged, the checklist is filled, and every photo must be confirmed by the officer before the file moves on.
  Reading handwritten Kannada is unreliable, so the officer's confirmation is the safeguard.
- **Applicant messages:** fixed Kannada templates (not AI) on receipt, return, approval and rejection, shown on the file. Set `SMS_WEBHOOK_URL` to a gateway that accepts
  `{to, message}`; otherwise messages stay `queued`. Phone numbers are demo values. Real SMS in India needs DLT-registered templates and applicant consent.

## Backend structure (MVC)
```
server/
  index.js                 entry point: migrate, then listen
  prompts.js, review.js    AI prompts and the Kannada review script
  src/
    app.js                 express app
    config/                settings and business constants (rules, step owners)
    routes/                URL -> controller, auth and role guards
    controllers/           HTTP only: read the request, call model/service, send the response
    models/                SQL and domain rules (Application, Document, History, Notification, AiLog, User, Report)
    views/                 JSON presenters: the exact shape the React client receives
    services/              workflow transaction, Ollama, messages, tokens, document checks
    middleware/            authentication, role check, error wrapper
    db/                    pool, transaction helper, migration and demo seed
  test/                    API tests (npm test)
```
Rule of thumb: controllers never write SQL, models never touch `req`/`res`, and the workflow rules live in one place (`services/workflowService.js`).
Set `API_PORT` to change the port (default 4000).

## Run
```bash
docker compose up -d                       # PostgreSQL (schema + 6 sample applications auto-loaded)
ollama pull gemma3:4b                      # or set OLLAMA_MODEL; test Kannada quality on your model
cd server && npm i && npm start            # API :4000
cd client && npm i && npm run dev          # UI  :5173
```

## Measuring impact
`GET /api/stats` gives: pending backlog, overdue count, average days submit-to-decision, % of actions where AI was used.
Compare before/after in one pilot taluk: median days to decision, % returned at step 3 (should fall as step 1 catches gaps),
applicant repeat visits, and officer time per file (short time-and-motion sample).

## Decisions and limits
- Rules (age 65+, income ≤ ₹20,000, BPL) are constants in `server/index.js`: confirm against the current government order.
- State changes run in a transaction with a row lock; invalid transitions are rejected server-side.
- Not built (scope): login/roles per officer, document photo upload, SMS to applicant, SLA settings, Kannada voice reading of AI text.
- Kannada AI quality varies by model; have a Kannada speaker review `client/src/i18n.js` and sample AI outputs before a pilot.
