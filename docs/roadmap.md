# ArbiGameFi Product Roadmap

> Revision: 2026.10-r2 · Updated: 2026-10-11 · External review copy
>
> Audience: users, capital and ecosystem partners, and people following the project
>
> 公开路线说明将交付的用户价值；内部工作包、经济参数校准和工程验收另行管理。

**Core and application interfaces implemented; local integration verified, release qualification pending.** NFT deposits, fixed 24-hour locks, LiquidityTree accounting
and same-transaction VRF settlement attempts follow the
[implementation plan](design/lp-accounting-and-callback-implementation.md). Earlier candidate
results do not establish that these replacements are implemented.

ArbiGameFi is building a single-brand wallet-native casino. The
roadmap concentrates first on a complete entertainment experience and a
sustainable relationship between players, underwriting capital and operating
partners. It describes intended capability, not a claim that every stage is
already available or a promise of release dates.

## 1. A complete casino experience

Players should be able to understand a game and its total cost, connect their
wallet, accept a quote and follow a round to a readable payment receipt.
Approval and betting are clear separate steps; normal settlement is automatic,
and an interrupted session can be recovered without placing an unintended bet.

The initial focus is the existing eight game families on Base with USDC. Real
mobile wallet use, understandable waiting and error states, and consistent
rules take priority over adding more games or chains. Users should not need a
technical whitepaper to complete the experience.

## 2. Clear economic participation

Capital providers should understand which pool they underwrite, how they are
compensated, what can reduce each deposit's value and when they can withdraw.
Partners should understand the source and conditions of referral compensation.

The casino model reserves a fixed 50% of turnover edge for LP economics, with referrals and protocol
fees funded from the operator half. Every LP addition creates a new deposit NFT in a dedicated Vault
with a fixed 24-hour lock. At maturity, owners can withdraw within node value and free capital;
partial success relocks the remainder, full withdrawal burns the NFT and transfer keeps the deadline.

Withdrawn capital has no future recovery claim. Remaining nodes receive or bear results according
to the bet's opening deposit-ID prefix and whole-tree fallbacks; newer deposits can participate in
older results. Zero-root profit belongs to protocol capital. No extra LP buffer or last-NFT restriction
applies. Normal withdrawal introduces no betting pause, but zero LP capital rejects new bets.

A recorded random result awaiting accounting blocks LP cash operations until it is booked or voided.
Stage 0 measures the adopted 40-level tree and full callback before selecting supported round limits.
The user accepted the existing pre-fulfillment LP ordering tradeoff with public disclosure.
External audit, strict gas qualification and fresh-network acceptance remain launch gates; the
24-hour lock and atomic callback do not establish complete protection or a guaranteed full-exit date.

## 3. Bounded service and responsible growth

The product first operates within a capital and service capacity that can be
funded and supported. Growth is evaluated using successful completion, voluntary
return, service quality and economic contribution together. Subsidies and test
activity are identified separately.

Real-money service opens only after the operating entity, jurisdictions and enforced compliance
controls (geo-blocking, sanctions screening, player limits) are in place. Broader acquisition follows
evidence that the experience works, capital is adequately understood and compensated, and support can
handle failures. Product
information and partner materials describe what people can actually use.

## 4. Sports betting as a future capability

The sportsbook is not part of this release, which covers the casino only. Sports
betting remains a possible future capability. It would return only as a new
implementation with its own design, audit and release, including its own odds,
result-evidence, dispute and capital rules. Casino readiness does not establish
sports readiness.

## 5. Expansion supported by demand

Additional casino games, assets, networks or integrations
are considered when a demonstrated user need and a sustainable operating case
justify them. Existing obligations and risk boundaries remain protected during
expansion. Architectural extensibility alone is not a reason to launch a new
business line or a white-label platform.

## Follow the project

- [Project brief](ARBIGAMEFI-EXECUTIVE-BRIEF.zh-CN.md): a short introduction and role-specific reading paths.
- [Business whitepaper](WHITEPAPER.product.zh-CN.md): the market, product and cooperation case.
- [Technical whitepaper](WHITEPAPER.zh-CN.md): mechanisms, design rationale and trust assumptions.
- [Current release](release/README.md): implementation scope and launch gates.
