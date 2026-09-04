---
name: API codegen and Zod compatibility
description: Compatibility constraint between the workspace OpenAPI generator and its installed Zod runtime.
---

The installed Orval/Zod combination emits `zod.int()` for OpenAPI integer schemas and `zod.email()` for `format: email`, but the workspace's Zod runtime does not expose those APIs. Use numeric schemas at the contract boundary, omit email format when it is not needed for client validation, and enforce integer semantics in application logic when needed.

**Why:** Code generation succeeds but the library typecheck fails after generation if unsupported integer or email helpers are emitted.

**How to apply:** Check generated Zod output after OpenAPI changes and run the API-spec codegen command before relying on new hooks or server validators. For request bodies, import the operation-specific generated validator (for example, `Update...Body`) rather than assuming the component interface itself is a runtime schema.