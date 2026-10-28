# Security

## Reporting a vulnerability

Please report vulnerabilities privately through [GitHub's private vulnerability reporting](https://github.com/Krelborn/markdown-review/security/advisories/new), not in a public issue. Include the version, what an attacker can do, and the steps to reproduce it.

Markdown Review is maintained in my spare time, so I can't promise a response time, but I read every report and will tell you what I plan to do about it.

## Supported versions

Only the latest release on npm gets security fixes.

## Scope

The server listens only on `127.0.0.1` and expects to be reached by the browser and by agents on the same machine. Ways around its protections are in scope, such as a web page or another local user reaching the agent routes without the token in `.markdown-review/server.json`, script running from a reviewed doc, or a file outside the repository being served.
Reports get a reply within a week.
