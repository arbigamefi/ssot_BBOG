# ArbiGameFi Go-To-Market Strategy

| Owner        | Growth + Product Lead                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Status       | Active                                                                                                                    |
| Last Updated | 2026-06-01                                                                                                                |
| Depends on   | `docs/strategy/fullstack-product-architecture.md`, `docs/strategy/sportsbook-production-roadmap.md`, `frontend/CLAUDE.md` |
| Supersedes   | Chat-only marketing/positioning discussion                                                                                |

> Living document. Captures the marketing and growth strategy the team is
> aligning on. When this conflicts with accepted ADRs, the active roadmap, or
> compliance reality, those sources win and this doc gets updated.

**Audience.** Founders, growth/marketing, BD, and the operators who will run the
launch. Engineers should read §6 (analytics as sales material) and §7
(compliance guardrails) because they shape what we build next.

**Scope.** This is the _why_ and the _what_ of growth — positioning, the
three-sided flywheel, per-audience playbooks, sequencing, and guardrails. It is
not a campaign calendar or a creative brief; those hang off this document.

**One-line thesis.**

> Build a B2C casino/sportsbook around the one wedge the incumbent category
> cannot copy cleanly — **verifiable on-chain settlement** — then use real vault
> data to recruit bankroll providers and the built-in affiliate system to
> acquire players, all bounded by jurisdiction and responsible-gambling
> constraints.

---

## 1. The product is B2C, with three GTM sides

ArbiGameFi's go-to-market is **single-brand B2C casino/sportsbook first**. It
also has three distinct economic sides, each with its own page, narrative, and
metric loop.

| Audience               | Where in the product                 | Economic role                                        |
| ---------------------- | ------------------------------------ | ---------------------------------------------------- |
| **Players**            | `/casino` (8 games) + `/sportsbook`  | Demand side — generate turnover                      |
| **Bankroll providers** | `/earn` (house bankroll, on-chain)   | Supply side — provide liquidity, earn the house edge |
| **Affiliates**         | `/affiliate` + `/portfolio/referral` | Distribution side — bring players, earn commission   |

The single most common GTM mistake in this category is treating all three as
"users" and marketing to them with one message, one channel, one funnel. They
need **different narratives, channels, retention mechanics, and KPIs.** The rest
of this document is organized around that fact.

---

## 2. Strategy spine: a flywheel, not a funnel

The three sides are mutually causal. Spending on any single side in isolation
leaks. Every tactic in this document hangs off this flywheel:

```
  Providers fund the vault ──► payout capacity / max bet ↑ ──► attracts players
        ▲                                                          │
        │                                                          ▼
   real yield ↑ (house edge)  ◄── turnover / NGR ↑  ◄────── players wager
        ▲                                                          │
        │                                                          ▼
   affiliate commission ↑  ◄───────────────  affiliates bring players
```

**Key insight — this is a hard-side / easy-side market.** Players are the easy
side (they show up where there is money to win). **Bankroll providers are the
hard side** — they must trust first, bear variance, and understand the yield
model. _The contest is won on the hard side._ See §5.

### Cold-start order (do not invert)

1. **Vault first.** No bankroll → no big payouts, no high multipliers → players
   churn even if acquired. Seed the vault from team/treasury at cold start.
2. **Activate affiliates.** They are the engine that brings players (and the
   reason the affiliate system is built-in, not bolted-on — see §4C).
3. **Player turnover produces real yield numbers** → use _real data, not an APY
   pitch_ to open the **public vault** to retail providers → flywheel closes.

---

## 3. Brand wedge: sell trust in a category defined by distrust

Every user in this category (Stake, Rollbit, Roobet, BetSwirl) carries one
underlying anxiety: **"will the house rig the game / refuse to pay / rug?"** The
product architecture is a direct answer to all three:

| User fear                       | Product answer                              | Marketing claim            |
| ------------------------------- | ------------------------------------------- | -------------------------- |
| "Will they rig the spin?"       | Chainlink VRF, verifiable draws             | Provably fair              |
| "Will my win actually pay?"     | On-chain settlement + receipt proof         | Wins settle to your wallet |
| "Will the house run dry / rug?" | Bankroll-backed + visible reserve/risk caps | Payout capacity is visible |

**Brand axis: `Don't trust. Verify.`**

This is not a tagline; it is the **GTM filter.** Every marketing action either
reinforces "verifiable" or we don't do it. It is also the _only_ seam we can
exploit: we will not out-spend or out-brand Stake, but we can play the card it
structurally cannot — on-chain transparency.

### ⚠️ Integrity red line (non-negotiable)

The analytics layer we ship is labeled **"indexed · best-effort,"** not
"on-chain verifiable." In marketing:

- **Result popups / settlement receipts** → may claim "verifiable on-chain"
  (they come from chain logs).
- **Leaderboards / RTP / global stats / vault yield** → may only claim "indexed
  data, may lag" (they come from the Postgres index, best-effort).

The moment best-effort data is packaged as "on-chain truth," the most rigorous
KOLs in the category will call it out publicly and the brand wedge collapses.
Honesty _is_ the moat here.

---

## 4. Three audiences, three playbooks

### 4A. Players (demand side)

**Sub-segments.**

- **Crypto degens** — chase high multipliers, value provable fairness, anti-CEX.
  The core.
- **Sports bettors** — event-driven, naturally high repeat (every fixture is a
  trigger), psychologically distinct from casino players.
- **"Fairness" migrants** — churned out of Web2 casinos, been stiffed before.
  Cleanest conversion.

**Value prop.** High multipliers + verifiable results + wallet-native settlement

- visible house reserves.

**Acquisition — note: this category is largely constrained by paid-ad policy.**
Google / Meta / X gambling ads are restricted by license, geo, and account
eligibility. Therefore:

1. **Affiliates / KOLs are channel #1** — this is _why_ the affiliate system is
   core, not auxiliary.
2. **Crypto Twitter / Telegram / Discord** native communities.
3. **Streaming-native creators** — gambling traffic is concentrated around live
   creator communities; treat streamer deals as affiliate/BD, not media buys.
4. **Chain ecosystem co-marketing** — "verifiable casino on Base," ecosystem
   programs.
5. **SEO** — `provably fair casino`, `on-chain dice`, per-game slug pages (the
   OG images + slug routes exist for exactly this) + crypto-casino review sites.

**Retention (everything we built recently is retention ammunition).**

- Leaderboard + podium + "your rank" → FOMO engine.
- XP buckets / weekly–monthly wager races.
- Transparency _is_ retention — players can replay every bet on-chain.

**KPIs.** CAC (≈ affiliate commission cost), NGR, D1/D7/D30 retention, turnover
per player, ARPU.

### 4B. Bankroll providers (supply side) — the decisive side; see §5

The full playbook for this side is §5 because it is the contest's hard side and
the highest-leverage place to apply real-yield data. In one line: **`Be the
house.`** Earn the house edge as _real yield_ (not token inflation),
on-chain-auditable, non-custodial. Tone is the inverse of player marketing —
calm, data-driven, risk-disclosed.

### 4C. Affiliates (distribution side) — run it like a B2B recruit

**Value prop. `Share the casino. Keep the proof on-chain.`** The killer feature
is **commission that is verifiable on-chain.** What Web2 affiliates hate most is
shaved / shadow-banned commission; first-touch binding + on-chain settlement
eliminate that. **This is the strongest pitch for poaching affiliates off
competitors.**

**Acquisition (this is B2B poaching).**

- Directly recruit competitors' existing affiliates / Telegram affiliate
  networks / KOLs / streamers.
- Offer: competitive rev-share, sub-affiliate tiers, **prompt payout**,
  ready-made multilingual asset packs.

**Retention.** Affiliate-facing leaderboards, tier progression, on-time payment,
dedicated support.

**KPIs.** Active affiliates, **affiliate-sourced NGR %**, sub-affiliate depth,
payout punctuality.

---

## 5. Bankroll-provider playbook (the decisive side)

### 5.0 What you are actually selling

> You are not selling "yield." You are selling **variance-bearing capital.**

Providers are underwriting — the same business as an insurer or an option
seller: they earn a **positive expectancy** (the house edge, ≈1% at RTP≈99%) and
pay for it in **variance** (the vault draws down when players run hot).

This re-definition drives three things:

1. **Attract the right capital, repel the wrong.** "50% APY!" attracts mercenary
   capital that panic-redeems on the first drawdown — and **redemption during a
   drawdown locks in the loss and cuts payout capacity**, the most toxic outcome
   for a vault. "Underwrite positive expectancy; long-run convergence, short-run
   variance" attracts **patient, sophisticated DeFi capital** — the capital the
   vault actually needs.
2. **Honesty is the moat.** A landing page that states "you will experience
   drawdowns" in the first screen is the most credible vault on a board full of
   APY fiction.
3. **It sets the design goal for `/earn`** — not to flaunt APY, but to let
   providers _understand the risk they bear and the money they make._

### 5.1 Yield model (the math providers actually need)

Net yield is a decomposable chain, not a single APY number:

```
net APY ≈ ( realized hold%  ×  velocity )  −  affiliate share  −  protocol fee
              (≈ house edge)   (turnover / TVL)
```

**The lever is velocity, not edge.** Edge is only ~1%, but the vault recycles:

> $1M vault, $50M monthly turnover (50× velocity), 1% edge → $500k monthly gross
> → **~600% gross annualized** (theoretical ceiling, before variance / costs /
> utilization).

So the provider's lifeblood number is **velocity / utilization**, not edge —
which means **player growth (demand side) is literally the numerator of provider
yield.** The flywheel closes mathematically here. Market to providers with
_historical real velocity and hold%_, never "we promise X% APY."

### 5.2 Risk model (a selling point, not a disclaimer)

The three questions a provider asks in diligence — answer them proactively:

| Risk                | Provider's worry                              | Your guardrail (already in product)                                                                         |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Variance / drawdown | "Will a hot streak blow me up?"               | Law of large numbers + live drawdown visible + risk disclosure                                              |
| Single max payout   | "Will one high-multiplier win tip the table?" | **max-bet-to-vault ratio cap** (Kelly / risk-of-ruin control) — the safety metric providers care about most |
| Rug / insolvency    | "Is my principal safe?"                       | Non-custodial + reserve ledger on-chain + audit                                                             |

→ **Action: keep `/earn`'s Risk tab explicit and visible.** It should surface
_current max single payout / vault balance_ when that policy data is available,
and otherwise state what is still pending. Sophisticated capital trusts you
_more_ for surfacing this number; competitors hide it.

### 5.3 `/earn` dashboard = the second monetization of the analytics layer

The aggregation layer we built for player FOMO feeds ~90% of the provider
diligence dashboard. **One body of work feeds both sides of the flywheel.** Keep
the data-honesty split rigorous (verifiable vs indexed):

| Provider metric             | How                              | Source                                                      | Label                      |
| --------------------------- | -------------------------------- | ----------------------------------------------------------- | -------------------------- |
| House P&L (vault gross)     | `turnover − payout`              | ✅ existing (`getCasinoStats`, already windowed 24h/7d/30d) | indexed · best-effort      |
| Realized hold% (real edge)  | `(turnover − payout) / turnover` | ✅ existing                                                 | indexed · best-effort      |
| Velocity                    | `turnover / vault TVL`           | ✅ indexed turnover + chain-read vault balance              | TVL verifiable             |
| Gross annualized yield      | `hold% × velocity` annualized    | ✅ composite of indexed stats + chain-read TVL              | best-effort estimate       |
| Vault balance / reserve     | direct contract read             | ✅ current Bank snapshot                                    | **✅ on-chain verifiable** |
| Drawdown curve              | cumulative House P&L timeseries  | ✅ indexed timeseries + provider ledger context             | indexed                    |
| Max single payout / balance | risk ratio                       | release/risk config + chain-read balance                    | config verifiable          |
| Net APY                     | after affiliate/protocol fees    | needs cost basis                                            | best-effort                |

**Integrity red line, applied here:** vault balance / reserve / max-bet config
read straight from chain → may claim "verifiable"; hold% / yield / drawdown
(from indexed turnover/payout) → "indexed, may lag." Render the two visually
distinct (a chain-link/explorer marker on verifiable values, a best-effort badge
on indexed). _That visual distinction is itself a trust signal._

Current product status: `/earn` already exposes the first version of this
diligence surface — indexed vault performance, verifiable reserve/risk tabs,
deposit/withdraw actions, and a provider ledger reconstructed from Bank share
mint/burn events plus matching asset transfers. The remaining GTM work is not
more generic dashboard chrome; it is the next evidence layer:

1. DeFiLlama TVL adapter and public TVL proof.
2. Provider-facing copy review on `/earn` so "indexed" and "verifiable" are
   visually impossible to confuse.
3. Launch gating for when the vault is closed, restricted, or open.
4. Public vault campaign assets only after real velocity / hold data exists.

Highest-ROI principle: keep turning protocol and index data into diligence
material. Do not invent APY claims.

### 5.4 Capital acquisition channels (different from player marketing)

Providers are a DeFi / real-yield audience — calm, data-driven, evidence-first.

| Channel                                         | Why                                       | Action                                                      |
| ----------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| TVL on DeFiLlama                                | the #1 discovery surface for DeFi capital | ship an adapter; expose vault TVL as a standard DeFi metric |
| Audit + formal verification as marketing assets | trust hard currency in this category      | publish audit report up top, not buried in footer           |
| The real-yield dashboard _as content_           | "don't trust, verify" is the brand axis   | `/earn` itself is the best sales material                   |
| DeFi Twitter / real-yield KOLs                  | they hunt non-inflationary real yield     | narrative "be the house, earn the edge"; **no APY fiction** |
| Yield aggregators / vault directories           | secondary distribution                    | integrate later                                             |

**Narrative axis: `Be the house.`** For centuries the house side of the table has
been closed to ordinary users. Here, retail can underwrite the house side — with
the ledger on-chain and principal non-custodial. Clean, compliance-friendly, and
only our architecture can say it (CEX casinos cannot claim "non-custodial +
auditable").

### 5.5 Phased capital strategy (with risk caps; never jump to public)

```
Phase 1 — Seed vault (team / treasury funded)
  Goal: cold-start; without a vault there is no payout capacity, players churn
  Posture: vault closed to outside capital; first job is to produce real
           hold% and velocity data

Phase 2 — Restricted public (whitelist / deposit cap)
  Goal: recruit the first providers with Phase 1's REAL data (not predictions)
  Risk: total deposits capped; max-bet/vault ratio held at a safe line
  → this is when /earn becomes provider-acquisition material, not just a product
    console

Phase 3 — Open public vault
  Goal: close the flywheel; provider yield driven by real player turnover
  Stack on: DeFiLlama TVL, yield KOLs, scale

Phase 4 — Governance / tranching (if a token)
  Vault governance, risk tranches (senior/junior), advanced structures
```

**Iron rule: never open the public vault before real velocity data exists.** No
data → only fiction → fiction attracts mercenary capital → mercenary capital
panic-redeems → the flywheel reverses. _Data first, then open._ This is why the
analytics layer is a prerequisite for this phase — the order cannot be inverted.

### 5.6 Retention = anti-panic-redemption

Provider retention ≠ player retention. The core job is keeping providers from
fleeing _during_ a drawdown:

- Live transparent drawdown curve + historical "drawdown → recovery"
  visualization → shows variance is normal and edge wins long-run.
- Expectation management: the landing page states "drawdowns will happen," so
  when one arrives the provider is neither surprised nor panicked.
- (Later) redemption buffer / lock-up to smooth runs on the bank (product +
  contract work, not pure marketing).
- Governance participation (Phase 4) — turn "provider" into "co-owner."

### 5.7 Provider KPIs

| Metric                          | Meaning                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------- |
| TVL                             | vault size (also the DeFiLlama surface)                                          |
| Net APY                         | real yield                                                                       |
| Utilization                     | how much TVL is actually working (low = idle capital = diluted yield)            |
| Velocity                        | the real engine of yield                                                         |
| Max drawdown                    | risk watermark                                                                   |
| Provider retention / net inflow | the ultimate trust measure; positive net inflow _during_ a drawdown = trust held |

---

## 6. Localization is the GTM map

The five shipped languages (`en / zh-Hans / pt-BR / ru / tr`) are not arbitrary
— they are the highest-LTV crypto-gambling market mix.

| Lang      | Market               | Why                                                                      | Entry tactic                                                     |
| --------- | -------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| **en**    | Global crypto-native | Beachhead; highest KOL/CT density                                        | Crypto Twitter / streamer affiliates / DeFiLlama                 |
| **pt-BR** | 🇧🇷 Brazil            | Large betting audience, strong creator market, high crypto familiarity   | Local Telegram groups, local affiliate networks, TikTok-adjacent |
| **ru**    | 🇷🇺 CIS               | Sanctions → crypto necessity; deep gambling culture; mature affiliates   | VK/Telegram; poach mature affiliate networks                     |
| **tr**    | 🇹🇷 Turkey            | Lira inflation → crypto hedge; offline gambling banned → online fills it | Local KOLs, Telegram, football betting                           |
| **zh**    | Chinese offshore     | Mainland ban → offshore crypto; high ARPU                                | Private communities; cautious (highest compliance risk — §7)     |

**Recommended market sequence:** en (validate the model) → pt-BR + tr (large
audiences, strong affiliate density) → ru (mature affiliates but complex
compliance) → zh (last, and offshore-compliant posture only). **Run 1–2 markets
at a time; do not open all five at once.**

---

## 7. Compliance guardrails (without this section the rest is castles in the air)

Crypto-gambling marketing is first a compliance problem, second a creative one.

1. **Paid ads are constrained** by gambling policy, license status, and region →
   the engine _must_ be **affiliates + communities + SEO**, not ad-buying.
   Budget structure follows: money goes into rev-share, not CPC.
2. **License posture** — do not name or imply a licensing path in marketing until
   counsel signs off. Offshore license options exist, but the selected posture
   determines claims, geos, onboarding, and affiliate terms.
3. **Geo-blocking + KYC** — the frontend has launch hooks for terms, age,
   responsible gambling, and self-exclusion. Server-side geo / sanctions / KYC
   enforcement remains a launch-readiness dependency, not a marketing asset.
   Marketing landing pages must match the actual enforcement posture; do not run
   traffic into blocked regions.
4. **Responsible gambling** — not just a compliance duty but a **brand asset**
   (especially for providers and regulator-friendly markets like Brazil).
5. **Chinese market: most cautious.** Mainland compliance risk is highest;
   offshore-compliant posture only, no mainland-targeted spend.

### Marketing-claim cheat sheet (ties §3 and §5.3 together)

| You may say "verifiable on-chain" about…                  | You may only say "indexed, may lag" about…                       |
| --------------------------------------------------------- | ---------------------------------------------------------------- |
| Individual result / settlement receipt (from chain logs)  | Leaderboards, "your rank"                                        |
| Vault balance / reserve / max-bet config (contract reads) | RTP, gain ratio, global stats                                    |
| Randomness (Chainlink VRF)                                | House P&L / hold% / yield (derived from indexed turnover/payout) |

---

## 8. Phased GTM roadmap (the whole thing on a timeline)

- **Phase 0 — Pre-launch / testnet.** Audit complete and published; seed
  community; **recruit the first affiliates early**; lay SEO/content groundwork;
  set the `Don't trust, verify` brand. Testnet and staging deployments must stay
  non-indexable; only the production domain should receive public SEO/affiliate
  traffic.
- **Phase 1 — Single-chain launch.** Team seeds the vault; activate affiliates;
  KOL/streamer first wave; first leaderboard wager race. **Validate the flywheel
  in the en market.**
- **Phase 2 — Growth.** Open the **public vault** using real yield data; scale
  affiliates; localize by the market map (pt-BR + tr first, each with local
  KOLs/communities); streamer affiliate deals. `/earn` should already be a
  credible diligence surface by this point; Phase 2 turns it into provider
  acquisition material.
- **Phase 3 — Scale.** Multi-chain rollout; governance token (if any); B2B /
  white-label output. _(Architecture supports white-label, but `CLAUDE.md`
  explicitly says no white-label work without real demand — gate this on inbound
  demand.)_

---

## 9. KPI summary (three independent scorecards)

| Side       | Primary KPIs                                                                        |
| ---------- | ----------------------------------------------------------------------------------- |
| Players    | CAC, NGR, D1/D7/D30 retention, turnover/player, ARPU                                |
| Providers  | TVL, net APY, utilization, velocity, max drawdown, net inflow during drawdown       |
| Affiliates | active affiliates, affiliate-sourced NGR %, sub-affiliate depth, payout punctuality |

---

## 10. One-line close

> The marketing of the decisive side (providers) is, at heart, _honestly telling
> a positive-expectancy underwriting story to sophisticated DeFi capital, using
> real protocol and index data as the diligence material_ — no APY fiction,
> never open the public vault before the data exists. `/earn`, the durable index,
> and the reserve/risk ledger are not just product features; they are the sales
> material for the side of the market that decides whether the flywheel starts.
