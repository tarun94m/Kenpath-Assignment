# Manual UI test cases (Kannada interface)

Automated API tests cover the rules and permissions (`npm test` in `server`). These cover what a person sees and does.
Accounts: `gao1`, `ri1`, `tah1`, password `demo123`. Reset data first: `docker compose down -v && docker compose up -d`, then restart the server.

| ID | Area | Steps | Expected |
|---|---|---|---|
| UI-01 | Login | Open the app, enter a wrong password | "ಹೆಸರು ಅಥವಾ ಗುಪ್ತಪದ ತಪ್ಪಾಗಿದೆ"; stays on the login page |
| UI-02 | Login | Log in as `gao1` | List opens; header shows name and role ಗ್ರಾಮ ಆಡಳಿತ ಅಧಿಕಾರಿ |
| UI-03 | Login | Press ಹೊರಗೆ, then reload | Back at login; no data visible |
| UI-04 | Session | Log in, then clear the token in browser storage and press any button | Sent back to login, no blank page |
| UI-05 | Queue | As `gao1` | Only step-1 files; `ri1` sees only step-2; `tah1` sees all open files plus a ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ tab |
| UI-06 | Priority | Look at the list order | Overdue (red) first, then nearest deadline; text like "3 ದಿನ ಮೀರಿದೆ" or "ಇಂದೇ ಕೊನೆ" |
| UI-07 | Counts | Look at the three boxes on top | ಬಾಕಿ / ಗಡುವು ಮೀರಿದ / ಇತ್ಯರ್ಥ match the files; overdue box turns red when above 0 |
| UI-08 | Tabs | Press ಮುಗಿದವು | Only approved/rejected files |
| UI-09 | Detail | Open a file | Name, village, reference, age, income; three-step bar with the current step highlighted |
| UI-10 | Checks | Open a file with a missing passbook or age 63 | The failing check is red with ✗; passing ones green |
| UI-11 | Read-only | As `tah1`, open a step-1 file | Note "ಈ ಹಂತ ಬೇರೆ ಅಧಿಕಾರಿಯದು"; no action buttons, no AI button |
| UI-12 | AI | As `gao1` press ✨ AI ಸಲಹೆ | Text appears gradually; first line is the Kannada suggestion tag; note "ಇದು ಕೇವಲ ಸಲಹೆ" |
| UI-13 | AI off | Stop Ollama, press the AI button | "AI ಈಗ ಲಭ್ಯವಿಲ್ಲ" message; buttons still work |
| UI-14 | Photos | At step 1, add a photo for each of the 4 items | Thumbnail appears; checklist item turns green |
| UI-15 | Photos | Try the next-step button with an unconfirmed photo | Message to confirm all photos first |
| UI-16 | Photos | Press ಸರಿಯಿದೆ, ಖಚಿತಪಡಿಸಿ on each, then next step | Moves to step 2; "✓ ಖಚಿತಪಡಿಸಲಾಗಿದೆ" shown before |
| UI-17 | Photos | Retake a photo | Old one is replaced and needs confirming again |
| UI-18 | Photos | Photograph something that is not a document | "ಫೋಟೋ ಓದಲಾಗಲಿಲ್ಲ"; officer can still confirm |
| UI-19 | Field notes | As `ri1` open a step-2 file, leave notes empty, press next, ಹೌದು | ಹೌದು is disabled; message to write notes |
| UI-20 | Field notes | Press 🎤 and speak Kannada (Chrome) | Text is added to the notes box |
| UI-21 | Confirm | Press ಮುಂದಿನ ಹಂತಕ್ಕೆ | "ಖಚಿತವೇ?" box scrolls into view; ಇಲ್ಲ cancels without change |
| UI-22 | Reasons | Press ತಿರಸ್ಕರಿಸಿ or ಹಿಂತಿರುಗಿಸಿ | Reason box appears; ಹೌದು disabled until text is entered |
| UI-23 | Approve | As `tah1` open a step-3 file | Button says ಮಂಜೂರು ಮಾಡಿ; after ಹೌದು the file shows ಮಂಜೂರು and leaves the open list |
| UI-24 | Return | Return a file with a reason as `gao1` | Status ಹಿಂತಿರುಗಿಸಲಾಗಿದೆ; ಮರುಸಲ್ಲಿಕೆ ಸ್ವೀಕರಿಸಿ button appears; pressing it moves the file to step 1 |
| UI-25 | History | Open a file after several actions | Newest first; each row has officer name, step, time, reason; "AI ಬಳಸಲಾಗಿದೆ" where used |
| UI-26 | Messages | After step-1 advance, return, and approval | "ಅರ್ಜಿದಾರರಿಗೆ ಸಂದೇಶಗಳು" lists each Kannada message with status |
| UI-27 | Agreement | As `tah1` press AI at step 3, then do the opposite of its suggestion | Dashboard disagreement list shows the case |
| UI-28 | Dashboard | As `tah1` open ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ | KPIs, bars by step and village (red = overdue), returns by step, outcomes, AI agreement |
| UI-29 | Mobile | Open on a phone (or 380px wide) | No sideways scrolling; buttons easy to tap; action bar stays at the bottom |
| UI-30 | Language | Read every screen | All text is Kannada and reads correctly; review with a Kannada speaker |
| UI-31 | Slow network | Throttle to "Slow 3G", upload a photo | "ಓದುತ್ತಿದೆ…" shows; no double submit; result appears |
| UI-32 | Errors | Stop the server, press any button | Error message in Kannada, no blank page |
