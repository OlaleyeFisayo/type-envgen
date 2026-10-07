# Security Policy

## Supported versions

Only the latest published version of `type-envgen` receives security fixes.

## Reporting a vulnerability

**Please don't report security issues in public issues, discussions or pull requests.**

Report them privately through GitHub:
[**Report a vulnerability**](https://github.com/OlaleyeFisayo/type-envgen/security/advisories/new)
(Security tab → "Report a vulnerability").

Please include:

- what the issue is and its impact
- steps or a minimal `.env` / command to reproduce it
- the `type-envgen` and Node.js versions you used

You'll get an acknowledgement as soon as possible. Once a fix is released, the advisory will be published with credit to you, unless you prefer to stay anonymous.

## Scope notes

`type-envgen` reads your `.env` file only to infer types. Values are never written to the generated file or sent anywhere. If you find a case where a value leaks into the output, that's a security bug — please report it.
