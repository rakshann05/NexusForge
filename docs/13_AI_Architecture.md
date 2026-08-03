# AI Architecture

AI is modeled as an `AiProvider` interface with capability checks and typed requests/responses. A `none` provider is the default and reports disabled without throwing system-wide errors. Provider keys live only in environment configuration; prompts and outputs are auditable and scoped to the caller's organization. Local models and remote providers are adapters, never dependencies of core task flows.
