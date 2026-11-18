# Metrics

| Metric | Definition | Target (first 90 days) | Source |
|---|---|---|---|
| **Activation** | Org completes first staff import within 24 h of sign-up | ≥ 60 % of new orgs | `audit_log` (first insert into `employees`) |
| **Time to first finding** | Sign-up → first finding shown | < 15 min median | `orgs.created_at`, `findings.first_seen_at` |
| **Weekly active firms** | Firms with ≥ 1 user action (view, fix, import) in the last 7 days | ≥ 6 of 10 pilots after 30 days | `audit_log`, auth sign-ins |
| **Findings fixed** | Share of red/advisory findings marked fixed within 14 days | ≥ 50 % | `findings.status`, `resolved_at` |
| **Score improvement** | Median change in company Inspection-Ready Score after 60 days | +15 points | Daily score snapshots |
| **Alert reach** | Share of orgs with Telegram connected | ≥ 50 % | Telegram link table |
| **Digest engagement** | Digests leading to an app visit within 48 h | ≥ 30 % | `alerts_log` + visits |
| **Quiz participation** | Users answering the weekly quiz | ≥ 40 % of weekly active users | Quiz answers |
| **Pilot → paid intent** | Pilots saying "would pay" at day 60 | ≥ 5 of 10 | Interview notes |
| **Self-check conversion** | Landing self-check → email captured → sign-up | 30 % → 10 % | Landing analytics (privacy-friendly) |

## Weekly review (30 minutes)
1. Activation funnel: sign-ups → import → first finding.
2. Top 5 rules by findings: false positives? Feed back to the lawyer.
3. Findings fixed vs new.
4. Lost or quiet pilots: call them.

Analytics must be privacy-friendly: no third-party trackers, and no employee personal data in analytics events.
