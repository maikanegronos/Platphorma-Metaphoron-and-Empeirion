---
name: API codegen and Zod compatibility
description: Compatibility constraint between the workspace OpenAPI generator and its installed Zod runtime.
---

The installed Orval/Zod combination emits `zod.int()` for OpenAPI integer schemas, but the workspace's Zod runtime does not expose that API. Use numeric schemas at the contract boundary and enforce integer semantics in application logic when needed.

**Why:** Code generation succeeds but the library typecheck fails after generation if integer schemas are used directly.

**How to apply:** Check the generated Zod output after OpenAPI changes and run the API-spec codegen command before relying on new hooks or server validators.