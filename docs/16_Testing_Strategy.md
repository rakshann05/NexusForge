# Testing Strategy

Unit-test domain services with Prisma and provider fakes. Integration-test controllers against a disposable PostgreSQL database. Add Playwright flows for registration, project creation, board transitions, and authorization boundaries. CI runs formatting/linting, typechecking/build, unit tests, and Prisma validation. Security-sensitive authorization tests are mandatory for each new resource.
