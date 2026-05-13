# Pull Request

## Summary

## SSOT / Invariants impact

- [ ] SSOT updated (docs/constitution)
- [ ] ADR added/updated (docs/adr)
- [ ] Unit tests added/updated
- [ ] Invariants remain green

## Threat analysis

What new risks does this change introduce?

## Checklist

- [ ] `forge test` passes locally
- [ ] `pnpm -C frontend test:strict` passes locally when frontend files changed
- [ ] No forbidden dependencies introduced (Bank -> SettlementRouter/hubs/modules, modules -> core, etc.)
- [ ] Events and errors updated as needed
- [ ] If I changed frontend behavior or architecture, I updated `frontend/docs/frontend/adr/` or related docs
- [ ] If I changed UI flows or components, Storybook/tests were updated as needed
