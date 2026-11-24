export const fail = (status, message) => Object.assign(new Error(message), { status });
// Wrap an async controller so a thrown error becomes a JSON response.
export const wrap = (fn) => (req, res) => fn(req, res).catch((e) => res.status(e.status || 500).json({ error: e.message }));
