import { inviteLink, inviteMessage, parseInviteCode } from "./sharing";

jest.mock("expo-linking", () => ({ createURL: (path: string) => `yearbookapp://${path}` }));

it("reads an invite code from a code, a link or a whole pasted message", () => {
  const token = "0123456789abcdef01234567";
  expect(parseInviteCode(token)).toBe(token);
  expect(parseInviteCode(`  ${token.toUpperCase()} `)).toBe(token);
  expect(parseInviteCode(`yearbookapp://invite/${token}`)).toBe(token);
  expect(parseInviteCode(`Join my yearbook\nOpen in the app: yearbookapp://invite/${token}\nOr enter this code: ${token}`)).toBe(token);
  expect(parseInviteCode("hello")).toBeUndefined();
  expect(parseInviteCode("0123")).toBeUndefined();
});

it("writes an invite message with both the link and the code", () => {
  const token = "0123456789abcdef01234567";
  const message = inviteMessage("Summer 2026", { token, expiresAt: "", link: inviteLink(token) });
  expect(message).toContain('"Summer 2026"');
  expect(message).toContain(`yearbookapp://invite/${token}`);
  expect(message).toContain(`code under Account → Join a shared project: ${token}`);
});
