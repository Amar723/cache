# Testing guidelines

- Start with the smallest relevant check.
- For TypeScript/API shape changes, run `npm run tsc`.
- For import, style, or React Native lint-sensitive changes, run `npm run lint`.
- For parsing, hooks, proximity, auth helpers, data transforms, or bug fixes, add/update focused Jest tests and run `npm test` or the relevant Jest target.
- Run broader checks before completion when a change touches shared behaviour across screens, stores, navigation, Supabase access, or background tasks.
- If a check is too expensive or blocked, state exactly what ran and what did not.
- Never say a check passed unless it actually ran.
