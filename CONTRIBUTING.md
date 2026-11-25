# Contributing

## Report a problem

Open an issue and say what you did, what you expected and what happened. For the Jira app, add the version shown in Jira's app list and say whether the site has Rovo.

Report a suspected vulnerability through the [private form](https://github.com/ALikesToCode/proof-of-done-docs/security/advisories/new), not in a public issue.

## Change the code

```
npm ci
npm test
npm run typecheck
```

Both need only Node.js 22 or newer. `npm run check` also runs `forge lint`, which needs the Forge CLI.

- Keep `src/core/` and `src/services/` free of Forge imports. `test/boundary.test.ts` fails when one appears.
- A change in behaviour comes with a test.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/), for example `fix(gate): ...`.
- Text in the README and the docs states what the code does today. A number needs its source.

The app is an entry in a contest that runs until 22 December 2026 and asks for the entrant's own work. Until then, issues are welcome and pull requests wait.
