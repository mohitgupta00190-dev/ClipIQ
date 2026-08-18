# Demo server path traversal exposure (2026-08-17)

## What happened
demo/server.js had a parent-directory fallback (`path.join(ROOT, "..", urlPath)`)
to serve /clipiq/* assets — but it applied to EVERY path, exposing the whole
/workspace tree publicly, including .git/config with a git credential token.
Caught by infra_verifier round 1. Fixed in same session.

## Fix pattern
- Reject any URL segment starting with "." (dotfiles + dot-segments)
- Whitelist exact external prefixes: ["/clipiq/", "/clipiq.zip"]
- decodeURIComponent BEFORE the dot-segment check (prevents %2e%2e bypass)

## Lesson
Any static server that resolves outside its docroot needs an explicit prefix
allowlist — "the file exists" is not a security check. Always probe /.git/config
over the PUBLIC preview URL after adding a file server.

## Outstanding
The leaked git token (8d7bbd8a…) was publicly readable for ~10 minutes.
User should rotate it (workspace sidebar → reconnect git credential).
