# v1.5 deployment

The supported deployment and release path is [v1.5 Safe governance](v15-release.md).

- [Current implementation status and evidence](v15/implementation-status.zh-CN.md)
- [Base mainnet public parameters](v15/chain-8453.env.example)
- [Base Sepolia public parameters](v15/chain-84532.env.example)
- [Immutable application images and Docker operations](../../frontend/deploy/docker/README.md)
- [Release artifact model](../release/README.md)

Use an explicit chain-specific packet and the approved Foundry keystore. `make deploy-dryrun` simulates; `make deploy-v15` broadcasts. Safe governance acceptance is a separate operation and must be verified before signing and packaging release metadata.

The working tree no longer carries v1.3/v1.4 deployment tools, generated artifacts or old deployment runbooks. Their history remains in Git at `a5d7d3fa50d4457f1476de0ac7fc3bd83ca49273`. Removing files does not retire deployed contracts or settle historical LP and fee obligations; track those in the current v1.5 closeout record.
