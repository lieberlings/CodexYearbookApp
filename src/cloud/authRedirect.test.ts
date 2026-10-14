import { parseAuthRedirect } from "./authRedirect";

it("reads a PKCE code from the query", () => {
  expect(parseAuthRedirect("yearbookapp://auth-callback?code=abc123")).toEqual({ kind: "code", code: "abc123" });
});

it("reads tokens from the fragment", () => {
  expect(parseAuthRedirect("yearbookapp://auth-callback#access_token=a&refresh_token=r&expires_in=3600")).toEqual({
    kind: "tokens",
    accessToken: "a",
    refreshToken: "r"
  });
});

it("reports provider errors", () => {
  expect(parseAuthRedirect("yearbookapp://auth-callback?error=access_denied&error_description=User+cancelled")).toEqual({
    kind: "error",
    message: "User cancelled"
  });
});

it("returns none for unrelated links", () => {
  expect(parseAuthRedirect("yearbookapp://auth-callback")).toEqual({ kind: "none" });
});
