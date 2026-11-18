# Tesuch · Տեսուչ

Keeps Armenian companies ready for a labour inspection: an Inspection-Ready Score, a per-employee timeline, and alerts before a legal deadline is missed. Built as a deterministic, versioned rules engine, not an AI chatbot.

> ⚠️ All rules are currently `needs_lawyer_review` and show as **advisory** only. This is not legal advice.

## Develop
```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # rules engine unit tests
pnpm test:db        # migrations + RLS cross-tenant tests on a throwaway local Postgres (not as root)
pnpm rules:matrix   # regenerate docs/RULES_MATRIX.md from rules/*.json
```

## Docs
[PRD](docs/PRD.md) · [Rules matrix](docs/RULES_MATRIX.md) · [Architecture](docs/ARCHITECTURE.md) · [Plan](docs/PLAN.md) · [Decisions](docs/DECISIONS.md) · [Investor requests](docs/INVESTOR_REQUESTS.md)
