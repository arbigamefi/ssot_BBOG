# Incident record

Keep one record per incident with the following facts. Never include private keys, API tokens,
credential-bearing URLs or database credentials.

- **Identity:** incident time in UTC, chain ID, verified release digest, source revision, affected
  Hub/Bank addresses and bet, ticket or batch IDs.
- **Impact:** actions currently unavailable, open positions, unresolved player/LP liabilities and
  affected users. Distinguish recorded settlement from a completed asset transfer.
- **Evidence:** block numbers, transaction hashes, decoded errors, relevant contract reads, health
  snapshots and redacted process logs. State whether evidence is local, staging or deployed.
- **Actions:** caller and authority, exact targets and calldata, simulations, receipts and readbacks.
  Record pause and governance actions separately from permissionless settlement/recovery.
- **Recovery:** oldest unresolved work, coverage/cursors, balances and liabilities before and after,
  retries still pending, and who owns follow-up work.
- **Cause and prevention:** confirmed cause, uncertain points, code/configuration correction and
  the test or operating check that detects recurrence.

Close the incident only after reconciling affected on-chain obligations and verifying the relevant
worker recovered. A health response alone does not establish payment or complete historical coverage.
See [runbooks](runbooks/README.md) for action-specific constraints.
