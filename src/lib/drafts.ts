/**
 * Lines written and not sent yet, kept per conversation while the app runs.
 *
 * A screen is drawn afresh whenever the conversation changes (Workspace keys
 * them by what is open), so a box that held its text in its own state lost
 * the draft on every switch - and, worse, when the session ended and the app
 * went back to sign-in. This keeps the text outside them, keyed by account
 * and conversation, so it is there again when the conversation is opened,
 * whichever way it was left. Nothing is written to the phone: a draft lives
 * as long as the app does.
 */
let scope = '';

const drafts = new Map<string, string>();

/** Whose drafts these are: called when another account opens. */
export function setDraftScope(account: string): void {
  scope = account;
}

const k = (key: string) => `${scope}/${key}`;

export function readDraft(key: string): string {
  return drafts.get(k(key)) ?? '';
}

export function writeDraft(key: string, text: string): void {
  if (text.trim()) drafts.set(k(key), text);
  else drafts.delete(k(key));
}
