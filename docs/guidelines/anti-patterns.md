# Anti-patterns

Avoid these unless the user explicitly asks and the reason is documented:

- Broad repo scans for a narrow task.
- Rewriting large files for a small behaviour change.
- Formatting unrelated files.
- Refactoring unrelated components, hooks, stores, SQL, or native config.
- Adding dependencies before checking the existing stack.
- Creating abstractions for one caller.
- Using `any` to silence TypeScript.
- Bypassing validation because the UI already checks input.
- Treating RLS, auth, visibility, or ownership as optional.
- Logging secrets, tokens, private user data, or precise location data.
- Running expensive full checks repeatedly when targeted checks answer the question.
- Long final summaries that hide the actual files changed and checks run.
