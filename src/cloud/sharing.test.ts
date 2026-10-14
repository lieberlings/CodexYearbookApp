import { formatInviteCode, inviteLink, inviteMessage, normalizeInviteCode } from "./sharing";

jest.mock("expo-linking", () => ({
  createURL: (path: string, options?: { queryParams?: Record<string, string> }) =>
    `yearbookapp://${path}${options?.queryParams ? `?${new URLSearchParams(options.queryParams).toString()}` : ""}`
}));
jest.mock("./supabaseClient", () => ({ requireSupabase: jest.fn() }));


it("accepts invite codes typed with spaces, dashes or lowercase", () => {
  expect(normalizeInviteCode(" abcd-2345 ")).toBe("ABCD2345");
  expect(formatInviteCode("abcd2345")).toBe("ABCD-2345");
});

it("builds an invite link and message", () => {
  expect(inviteLink("abcd-2345")).toBe("yearbookapp://join?code=ABCD2345");
  const message = inviteMessage("Summer 2026", "ABCD2345", "contributor");
  expect(message).toContain('add photos to "Summer 2026"');
  expect(message).toContain("ABCD-2345");
});
