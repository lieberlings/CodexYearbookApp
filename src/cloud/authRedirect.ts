// Pulls the sign-in result out of the URL the browser hands back: a PKCE
// `code`, or tokens in the fragment, or an error.
export type AuthRedirectResult =
  | { kind: "code"; code: string }
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

function params(part: string | undefined): URLSearchParams {
  return new URLSearchParams(part ?? "");
}

export function parseAuthRedirect(url: string): AuthRedirectResult {
  const [beforeHash, hash] = url.split("#", 2);
  const query = beforeHash.includes("?") ? beforeHash.slice(beforeHash.indexOf("?") + 1) : "";
  const all = new URLSearchParams();
  for (const source of [params(query), params(hash)]) {
    source.forEach((value, key) => all.set(key, value));
  }
  const error = all.get("error_description") ?? all.get("error");
  if (error) {
    return { kind: "error", message: error.replace(/\+/g, " ") };
  }
  const code = all.get("code");
  if (code) {
    return { kind: "code", code };
  }
  const accessToken = all.get("access_token");
  const refreshToken = all.get("refresh_token");
  if (accessToken && refreshToken) {
    return { kind: "tokens", accessToken, refreshToken };
  }
  return { kind: "none" };
}
