// Everything the model is told lives in this file, so a Kannada speaker can review and edit it in one place.
// Bump PROMPT_VERSION whenever the wording changes: every AI suggestion is logged with it.
export const PROMPT_VERSION = 'v2';

// Rule-check failures are given to the model as Kannada sentences, not internal codes like "d_b".
export const CHECK_KN = {
  age: 'ವಯಸ್ಸು ೬೫ ಕ್ಕಿಂತ ಕಡಿಮೆ ಇದೆ', income: 'ವಾರ್ಷಿಕ ಆದಾಯ ₹೨೦,೦೦೦ ಕ್ಕಿಂತ ಹೆಚ್ಚು ಇದೆ', bpl: 'ಬಿಪಿಎಲ್ ಕಾರ್ಡ್ ಇಲ್ಲ',
  d_a: 'ವಯಸ್ಸಿನ ಪುರಾವೆ ಇಲ್ಲ', d_i: 'ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ ಇಲ್ಲ', d_b: 'ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್ ಇಲ್ಲ', d_p: 'ಭಾವಚಿತ್ರ ಇಲ್ಲ',
};
// What the officer sees as the first line of a suggestion.
export const TAG_KN = { CONTINUE: 'ಮುಂದುವರಿಸಿ', APPROVE: 'ಮಂಜೂರು ಮಾಡಬಹುದು', REJECT: 'ತಿರಸ್ಕರಿಸಬಹುದು', RETURN: 'ಹಿಂತಿರುಗಿಸಿ' };
// Outcomes the model may suggest at each step. Step 2 is questions only, so it suggests nothing (NONE).
export const ALLOWED = { 1: ['CONTINUE', 'RETURN', 'REJECT'], 2: [], 3: ['APPROVE', 'REJECT', 'RETURN'] };

export const SYSTEM = `You help village revenue officers in Karnataka process old-age pension applications.
Write in simple, polite, spoken Kannada (ಕನ್ನಡ) that a village officer would use. Short sentences. No markdown. No English words in the Kannada text.
Preferred words: ಅರ್ಜಿದಾರರು, ಬಿಪಿಎಲ್ ಕಾರ್ಡ್, ಬ್ಯಾಂಕ್ ಪಾಸ್‌ಬುಕ್, ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ, ವಯಸ್ಸಿನ ಪುರಾವೆ, ಪಿಂಚಣಿ, ಸ್ಥಳ ಪರಿಶೀಲನೆ.
Use ONLY the facts given. Never invent names, dates, amounts, rules or documents. The officer decides; you only suggest.
FORMAT: the first line must be exactly one English word from the allowed list given in the task. Then a new line. Then the Kannada text.`;

export function buildPrompt(a, failedKeys) {
  const problems = failedKeys.length ? failedKeys.map((k) => CHECK_KN[k]).join('; ') : 'ಯಾವುದೂ ಇಲ್ಲ';
  const facts = `Applicant: ${a.name}, age ${a.age}, annual income Rs ${a.income}, village ${a.village}.\nProblems found by the rule check: ${problems}.`;
  const task = {
    1: `Step 1: document check. Allowed first words: CONTINUE (nothing is wrong), RETURN (only documents are missing; the applicant must bring them), REJECT (age, income or BPL rule is not met).
Then write at most 3 short Kannada lines: what is wrong or missing and what the applicant should bring. If nothing is wrong, say the file is ready for the field visit.`,
    2: `Step 2: field visit by the Revenue Inspector. The first line must be the word NONE.
Then write 4 short yes/no questions in Kannada to ask at the doorstep: lives at this address, age matches the proof, receives no other pension, bank account is theirs.`,
    3: `Step 3: Tahsildar's decision. Allowed first words: APPROVE (no problems and the field notes confirm the details), REJECT (a rule is not met), RETURN (something is unclear, missing, or the field notes contradict the application or are empty).
Then write a 3-line note in Kannada giving the reason. Field notes: "${a.field_notes || 'none'}".`,
  }[a.stage];
  return `${facts}\n${task}`;
}
