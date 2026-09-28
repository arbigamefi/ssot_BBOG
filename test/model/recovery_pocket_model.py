"""Executable specification of the proposed recovery-pocket accounting, not Solidity.

Run: python3 -m unittest discover -s test/model -p 'recovery_pocket_model.py' -v

Each seal quarantines ONLY the current epoch's full reserve R. Snapshot ALL real
LP units S, including queued units attributed to their controllers. With N the
pre-seal active NAV, L=N-R, and the existing virtual offset V:

    G(x) = min(floor(S*(x+V)/(S+V)), x)
    exiting Q's liquid batch = floor(Q*G(L)/S)
    D = R - cumulative_cost - remaining_reserve
    H = G(L+D) - G(L)             # cumulative recovery for real snapshot LPs
    U = D-H                      # cumulative virtual residual, credited to PF

The protocol owns U, final recovery rounding dust, and L-G(L) when ALL real
shares exit. These are explicit PROPOSED economic rules, not implementation
compatibility. Partial exits do not skim L-G(L) from staying LPs. Liquid batch
rounding dust returns to active capital for partial exits, but becomes PF for
full exits, so later depositors cannot inherit an ownerless full-exit remainder.
None of these protocol credits increments the gameplay protocol-fee counter.

Recovery = floor(snapshot_units*H/S) minus amounts already claimed. Claiming
never forfeits later recoveries. Old terminal costs include net player payment,
refund, gameplay PF, and all XP, whether paid immediately or booked as payable.
Each hold names exactly one epoch. Later seals, deposits, and active-share
transfers cannot acquire or erase earlier snapshot rights. Active NAV excludes
the aggregate pocket liability P as well as PF, XP, player and liquid payables.
The empty string ZERO represents the zero address; BANK represents the vault.
Neither may own active shares or control a request. Internal escrow is accounted
separately, so request/cancel must not create either as a wallet beneficiary.

Snapshots below are explicit copies as an independent ownership oracle. A
contract would need lazy wallet checkpoints plus immutable per-epoch queued
controller weights; this file does NOT prove that implementation or its gas
bound. audit() intentionally scans complete state. It is a test oracle, not a
proposed on-chain loop. Terminal accounting itself addresses one epoch only.
No deadlines, forced refunds, token anomalies, authorization/permit mechanisms,
reentrancy, ERC interfaces, or deployment readiness are established here.
"""

from dataclasses import dataclass, field
from fractions import Fraction
from itertools import permutations
import unittest


BANK = "<bank>"
ZERO = ""


def require_holder(account):
    if account in (BANK, ZERO):
        raise ValueError("Bank and zero address cannot own shares or control requests")


def real_lp_pool(assets: int, supply: int, offset: int) -> int:
    if assets < 0 or supply <= 0 or offset <= 0:
        raise ValueError("invalid valuation state")
    return min(supply * (assets + offset) // (supply + offset), assets)


@dataclass
class Hold:
    epoch: int
    player: str
    stake: int
    reserve: int
    open: bool = True


@dataclass
class Pocket:
    nav: int
    supply: int
    initial_reserve: int
    offset: int
    units: dict[str, int]
    remaining_holds: int
    remaining_reserve: int
    cost: int = 0
    virtual_allocated: int = 0
    claimed: dict[str, int] = field(default_factory=dict)
    final_synced: set[str] = field(default_factory=set)
    final_units: int = 0
    final_entitlements: int = 0
    released_dust: int = 0
    dust_finalized: bool = False

    @property
    def liquid_nav(self):
        return self.nav - self.initial_reserve

    @property
    def released(self):
        return self.initial_reserve - self.cost - self.remaining_reserve

    @property
    def recovery(self):
        return (real_lp_pool(self.liquid_nav + self.released, self.supply, self.offset)
                - real_lp_pool(self.liquid_nav, self.supply, self.offset))

    @property
    def virtual(self):
        return self.released - self.recovery

    @property
    def liability(self):
        return (self.initial_reserve - self.cost - self.virtual_allocated
                - sum(self.claimed.values()) - self.released_dust)


@dataclass
class LiquidBatch:
    shares: int
    assets: int
    requests: dict[str, int]
    full_exit: bool
    assigned: set[str] = field(default_factory=set)
    assigned_units: int = 0
    assigned_assets: int = 0
    claimed: dict[str, int] = field(default_factory=dict)
    released_dust: int = 0

    @property
    def liability(self):
        return self.assets - sum(self.claimed.values()) - self.released_dust


class RecoveryBank:
    """Exact-transfer reference ledger. Initial assets/supply describe any reachable book state."""

    def __init__(self, assets, wallets, offset=1):
        if assets < 0 or offset <= 0 or any(q < 0 for q in wallets.values()):
            raise ValueError("invalid initial state")
        for owner in wallets:
            require_holder(owner)
        self.cash = self.cash_in = self.expected_active = assets
        self.cash_out = 0
        self.wallets = dict(wallets)
        self.supply = sum(wallets.values())
        self.offset = offset
        self.requests = {}
        self.epoch = 1
        self.current_reserve = self.current_holds = 0
        self.holds = {}
        self.pockets = {}
        self.batches = {}
        self.p = self.exit_payable = self.pf = self.xp = 0
        self.player_payable = {}
        self.receipts = {}
        self.pf_game = self.pf_virtual = self.pf_dust = self.pf_paid = 0
        self.xp_accrued = self.xp_paid = 0
        self.last_terminal_epoch = None

    @property
    def active(self):
        return (self.cash - self.pf - self.xp - sum(self.player_payable.values())
                - self.exit_payable - self.p)

    def _receive(self, amount):
        self.cash += amount
        self.cash_in += amount

    def _pay(self, owner, amount):
        if amount < 0 or amount > self.cash:
            raise ValueError("unfunded payment")
        self.cash -= amount
        self.cash_out += amount
        self.receipts[owner] = self.receipts.get(owner, 0) + amount

    def _protocol_credit(self, amount, kind):
        assert amount >= 0
        self.pf += amount
        if kind == "virtual":
            self.pf_virtual += amount
        elif kind == "dust":
            self.pf_dust += amount
        else:
            self.pf_game += amount

    def deposit(self, owner, assets):
        require_holder(owner)
        shares = assets * (self.supply + self.offset) // (self.active + self.offset)
        if assets <= 0 or shares <= 0:
            raise ValueError("zero-share deposit")
        self._receive(assets)
        self.expected_active += assets
        self.wallets[owner] = self.wallets.get(owner, 0) + shares
        self.supply += shares
        return shares

    def transfer(self, sender, receiver, shares):
        require_holder(sender)
        require_holder(receiver)
        if shares < 0 or shares > self.wallets.get(sender, 0):
            raise ValueError("insufficient shares")
        self.wallets[sender] -= shares
        self.wallets[receiver] = self.wallets.get(receiver, 0) + shares

    def request(self, owner, controller, shares):
        require_holder(owner)
        require_holder(controller)
        if shares <= 0 or shares > self.wallets.get(owner, 0):
            raise ValueError("insufficient request shares")
        self.wallets[owner] -= shares
        self.requests[controller] = self.requests.get(controller, 0) + shares

    def cancel(self, controller):
        require_holder(controller)
        shares = self.requests.pop(controller, 0)
        self.wallets[controller] = self.wallets.get(controller, 0) + shares
        return shares

    def open_hold(self, key, stake, reserve, player="player", risk_bps=0):
        if key in self.holds or stake <= 0 or reserve < stake or not 0 <= risk_bps <= 10_000:
            raise ValueError("invalid hold")
        after = self.active + stake
        if after < self.current_reserve + reserve + after * risk_bps // 10_000:
            raise ValueError("insufficient active capital")
        self._receive(stake)
        self.expected_active += stake
        self.current_reserve += reserve
        self.current_holds += 1
        self.holds[key] = Hold(self.epoch, player, stake, reserve)

    def seal(self):
        q = sum(self.requests.values())
        if q <= 0 or self.supply <= 0 or self.active < self.current_reserve:
            raise ValueError("invalid seal")
        epoch, nav, supply, reserve = self.epoch, self.active, self.supply, self.current_reserve
        units = {owner: value for owner, value in self.wallets.items() if value}
        for controller, value in self.requests.items():
            units[controller] = units.get(controller, 0) + value
        assert sum(units.values()) == supply
        self.pockets[epoch] = Pocket(nav, supply, reserve, self.offset, units,
                                     self.current_holds, reserve)
        liquid = nav - reserve
        pool = real_lp_pool(liquid, supply, self.offset)
        assets = q * pool // supply
        self.batches[epoch] = LiquidBatch(q, assets, dict(self.requests), q == supply)
        self.p += reserve
        self.exit_payable += assets
        self.expected_active -= reserve + assets
        self.supply -= q
        self.requests = {}
        self.current_reserve = self.current_holds = 0
        self.epoch += 1
        if q == supply:
            virtual = liquid - pool
            self._protocol_credit(virtual, "virtual")
            self.expected_active -= virtual
        return epoch

    def settle(self, key, *, net=0, refund=0, pf=0, xp=0, transfer_ok=True):
        hold = self.holds[key]
        cost = net + refund + pf + xp
        if not hold.open or min(net, refund, pf, xp) < 0 or refund > hold.stake or cost > hold.reserve:
            raise ValueError("invalid complete terminal cost")
        self.last_terminal_epoch = hold.epoch
        if hold.epoch in self.pockets:
            pocket = self.pockets[hold.epoch]
            pocket.cost += cost
            pocket.remaining_reserve -= hold.reserve
            pocket.remaining_holds -= 1
            delta_virtual = pocket.virtual - pocket.virtual_allocated
            assert delta_virtual >= 0
            pocket.virtual_allocated += delta_virtual
            self.p -= cost + delta_virtual
            self._protocol_credit(delta_virtual, "virtual")
        else:
            assert hold.epoch == self.epoch
            self.current_reserve -= hold.reserve
            self.current_holds -= 1
            self.expected_active -= cost
        hold.open = False
        player_owed = net + refund
        if transfer_ok:
            self._pay(hold.player, player_owed)
        else:
            self.player_payable[hold.player] = self.player_payable.get(hold.player, 0) + player_owed
        self._protocol_credit(pf, "game")
        self.xp += xp
        self.xp_accrued += xp

    def claim_player(self, player):
        amount = self.player_payable.pop(player, 0)
        self._pay(player, amount)
        return amount

    def claim_protocol(self):
        amount = self.pf
        self.pf = 0
        self.pf_paid += amount
        self._pay("protocol", amount)
        return amount

    def claim_xp(self):
        amount = self.xp
        self.xp = 0
        self.xp_paid += amount
        self._pay("xp", amount)
        return amount

    def claim_liquid(self, epoch, controller):
        batch = self.batches[epoch]
        q = batch.requests.get(controller, 0)
        entitlement = q * batch.assets // batch.shares
        if q and controller not in batch.assigned:
            batch.assigned.add(controller)
            batch.assigned_units += q
            batch.assigned_assets += entitlement
            if batch.assigned_units == batch.shares:
                dust = batch.assets - batch.assigned_assets
                batch.released_dust = dust
                self.exit_payable -= dust
                if batch.full_exit:
                    self._protocol_credit(dust, "dust")
                else:
                    self.expected_active += dust
        amount = entitlement - batch.claimed.get(controller, 0)
        batch.claimed[controller] = entitlement
        self.exit_payable -= amount
        self._pay(controller, amount)
        return amount

    def final_sync(self, epoch, owner):
        pocket = self.pockets[epoch]
        if pocket.remaining_holds:
            raise ValueError("future recoveries remain possible")
        units = pocket.units.get(owner, 0)
        if not units or owner in pocket.final_synced:
            return
        pocket.final_synced.add(owner)
        pocket.final_units += units
        pocket.final_entitlements += units * pocket.recovery // pocket.supply
        if pocket.final_units == pocket.supply:
            assert not pocket.dust_finalized
            pocket.released_dust = pocket.recovery - pocket.final_entitlements
            pocket.dust_finalized = True
            self.p -= pocket.released_dust
            self._protocol_credit(pocket.released_dust, "dust")

    def claim_recovery(self, epoch, owner):
        pocket = self.pockets[epoch]
        if not pocket.remaining_holds:
            self.final_sync(epoch, owner)
        entitlement = pocket.units.get(owner, 0) * pocket.recovery // pocket.supply
        amount = entitlement - pocket.claimed.get(owner, 0)
        assert amount >= 0
        pocket.claimed[owner] = entitlement
        self.p -= amount
        self._pay(owner, amount)
        return amount

    def audit(self):
        """Independent full-state reconciliation; deliberately outside bounded accounting operations."""
        assert not set(self.wallets).intersection((BANK, ZERO))
        assert not set(self.requests).intersection((BANK, ZERO))
        assert self.cash == self.cash_in - self.cash_out
        assert self.active == self.expected_active >= self.current_reserve >= 0
        assert self.supply == sum(self.wallets.values()) + sum(self.requests.values())
        assert self.p == sum(p.liability for p in self.pockets.values()) >= 0
        assert self.exit_payable == sum(b.liability for b in self.batches.values()) >= 0
        assert self.pf == self.pf_game + self.pf_virtual + self.pf_dust - self.pf_paid >= 0
        assert self.xp == self.xp_accrued - self.xp_paid >= 0
        current = [h for h in self.holds.values() if h.open and h.epoch == self.epoch]
        assert self.current_reserve == sum(h.reserve for h in current)
        assert self.current_holds == len(current)
        for epoch, pocket in self.pockets.items():
            assert not set(pocket.units).intersection((BANK, ZERO))
            assert not set(self.batches[epoch].requests).intersection((BANK, ZERO))
            old = [h for h in self.holds.values() if h.open and h.epoch == epoch]
            assert pocket.remaining_reserve == sum(h.reserve for h in old)
            assert pocket.remaining_holds == len(old)
            assert pocket.nav >= pocket.initial_reserve >= pocket.cost + pocket.remaining_reserve
            assert sum(pocket.units.values()) == pocket.supply
            assert 0 <= pocket.recovery <= pocket.released
            assert pocket.virtual_allocated == pocket.virtual
            assert pocket.liability >= pocket.remaining_reserve
            for owner, claimed in pocket.claimed.items():
                assert claimed <= pocket.units.get(owner, 0) * pocket.recovery // pocket.supply


class RecoveryPocketTests(unittest.TestCase):
    def test_integer_curve_is_monotone_and_one_lipschitz(self):
        count = 0
        for supply in range(1, 17):
            for offset in range(1, 7):
                for liquid in range(33):
                    previous_h = previous_u = 0
                    for released in range(33):
                        g0 = real_lp_pool(liquid, supply, offset)
                        g1 = real_lp_pool(liquid + released, supply, offset)
                        rational = min(Fraction(supply * (liquid + released + offset), supply + offset),
                                       Fraction(liquid + released))
                        self.assertEqual(g1, rational.numerator // rational.denominator)
                        h = g1 - g0
                        u = released - h
                        self.assertGreaterEqual(h, previous_h)
                        self.assertGreaterEqual(u, previous_u)
                        self.assertLessEqual(h, released)
                        previous_h, previous_u = h, u
                        count += 1
        self.assertEqual(count, 104_544)

    def test_individual_difference_of_floors_would_overpay(self):
        # Two one-share holders, S=2, L=1, final x=2, one unit released.
        bad = sum(q * 2 // 2 - q * 1 // 2 for q in (1, 1))
        h = real_lp_pool(2, 2, 1) - real_lp_pool(1, 2, 1)
        good = sum(q * h // 2 for q in (1, 1))
        self.assertEqual(bad, 2)
        self.assertEqual(h, 1)
        self.assertEqual(good, 0)

    def test_all_integer_owner_partitions_fit_the_recovery_pool(self):
        count = 0
        for supply in range(1, 13):
            for a in range(supply + 1):
                for b in range(supply - a + 1):
                    weights = (a, b, supply - a - b)
                    for recovery in range(41):
                        paid = sum(q * recovery // supply for q in weights)
                        self.assertLessEqual(paid, recovery)
                        self.assertLessEqual(recovery - paid, sum(q > 0 for q in weights) - 1)
                        count += 1
        self.assertEqual(count, 18_614)

    def test_cumulative_claims_preserve_subunit_recovery_until_it_accumulates(self):
        bank = RecoveryBank(0, {"alice": 1, "bob": 2})
        for i in range(3):
            bank.open_hold(i, 1, 1)
        bank.request("alice", "alice", 1)
        epoch = bank.seal()
        actual = []
        for i in range(3):
            bank.settle(i)
            actual.append(bank.claim_recovery(epoch, "alice"))
            bank.audit()
        self.assertEqual(actual, [0, 0, 1])
        self.assertEqual(bank.claim_recovery(epoch, "bob"), 2)
        self.assertEqual(bank.claim_recovery(epoch, "alice"), 0)
        bank.audit()

    def test_repeated_exits_continue_with_a_permanently_open_first_epoch(self):
        bank = RecoveryBank(1_000, {"alice": 1_000}, offset=10)
        bank.open_hold("stuck", 10, 100)
        bank.request("alice", "alice", 100)
        first = bank.seal()
        bank.claim_liquid(first, "alice")
        frozen = dict(bank.pockets[first].units)
        for epoch in range(2, 10):
            bank.deposit("bob", 20)
            bank.open_hold(epoch, 2, 4)
            bank.request("bob", "bob", bank.wallets["bob"])
            self.assertEqual(bank.seal(), epoch)
            bank.settle(epoch, net=1, pf=1)
            self.assertGreater(bank.claim_liquid(epoch, "bob"), 0, "every later epoch pays an actual funded exit")
            self.assertEqual(bank.wallets["bob"], 0)
            bank.claim_recovery(epoch, "bob")
            self.assertTrue(bank.holds["stuck"].open)
            self.assertEqual(bank.pockets[first].units, frozen)
            self.assertEqual(bank.pockets[first].cost, 0)
            self.assertEqual(bank.last_terminal_epoch, epoch)
            bank.audit()
        self.assertEqual(len(bank.pockets), 9)
        self.assertEqual(bank.pockets[first].remaining_holds, 1)

    def test_other_recoveries_are_claimable_while_one_old_hold_is_stuck(self):
        bank = RecoveryBank(100, {"alice": 50, "bob": 50})
        bank.open_hold("stuck", 1, 20)
        bank.open_hold("resolved", 1, 20)
        bank.request("alice", "alice", 10)
        epoch = bank.seal()
        bank.settle("resolved", net=4)
        self.assertEqual(bank.pockets[epoch].recovery, 16)
        self.assertEqual(bank.claim_recovery(epoch, "alice"), 8)
        self.assertEqual(bank.claim_recovery(epoch, "bob"), 8)
        with self.assertRaises(ValueError):
            bank.final_sync(epoch, "alice")
        bank.settle("stuck", refund=1)
        self.assertEqual(bank.claim_recovery(epoch, "alice"), 9)
        self.assertEqual(bank.claim_recovery(epoch, "bob"), 9)
        self.assertEqual(bank.pf_dust, 1)
        bank.audit()

    def test_full_exit_new_depositor_never_receives_old_recovery(self):
        bank = RecoveryBank(100, {"alice": 100})
        bank.open_hold("old", 20, 40)
        bank.request("alice", "alice", 100)
        old_epoch = bank.seal()
        self.assertEqual(bank.active, 0)
        self.assertEqual(bank.supply, 0)
        self.assertEqual(bank.claim_liquid(old_epoch, "alice"), 80)
        self.assertEqual(bank.deposit("bob", 50), 50)
        bank.open_hold("new", 10, 20)
        active_before = bank.active
        bank.settle("old")
        self.assertEqual(bank.active, active_before)
        self.assertEqual(bank.claim_recovery(old_epoch, "alice"), 39)
        self.assertEqual(bank.claim_recovery(old_epoch, "bob"), 0)
        self.assertEqual(bank.pf_virtual, 1)
        self.assertEqual(bank.active, 60)
        bank.settle("new", net=20)
        bank.request("bob", "bob", 50)
        new_epoch = bank.seal()
        self.assertEqual(bank.claim_liquid(new_epoch, "bob"), 40)
        bank.audit()

    def test_full_exit_virtual_liquid_residual_goes_to_protocol_once(self):
        bank = RecoveryBank(220, {"alice": 100}, offset=10)
        bank.request("alice", "alice", 100)
        epoch = bank.seal()
        self.assertEqual(bank.claim_liquid(epoch, "alice"), 209)
        self.assertEqual(bank.active, 0)
        self.assertEqual(bank.pf_virtual, 11)
        self.assertEqual(bank.pf_game, 0)
        self.assertEqual(bank.deposit("bob", 17), 17)
        self.assertEqual(bank.claim_protocol(), 11)
        self.assertEqual(bank.active, 17)
        bank.audit()

    def test_partial_exits_do_not_tax_stayers_for_all_virtual_liquid_residual(self):
        bank = RecoveryBank(220, {"alice": 50, "bob": 50}, offset=10)
        bank.request("alice", "alice", 50)
        first = bank.seal()
        self.assertEqual(bank.claim_liquid(first, "alice"), 104)
        self.assertEqual(bank.active, 116)
        self.assertEqual(bank.pf_virtual, 0)
        bank.request("bob", "bob", 50)
        second = bank.seal()
        self.assertEqual(bank.claim_liquid(second, "bob"), 105)
        self.assertEqual(bank.pf_virtual, 11)
        self.assertEqual(bank.active, 0)
        bank.audit()

    def test_virtual_recovery_is_a_protocol_payable_not_gameplay_fee_or_new_lp_profit(self):
        bank = RecoveryBank(1_000, {"alice": 100}, offset=10)
        bank.open_hold("old", 20, 100)
        bank.request("alice", "alice", 10)
        epoch = bank.seal()
        bank.deposit("bob", 100)
        active_before = bank.active
        bank.settle("old", net=30)
        self.assertEqual(bank.pockets[epoch].recovery, 64)
        self.assertEqual(bank.pockets[epoch].virtual, 6)
        self.assertEqual(bank.pf_virtual, 6)
        self.assertEqual(bank.pf_game, 0)
        self.assertEqual(bank.active, active_before)
        self.assertEqual(bank.claim_recovery(epoch, "alice"), 64)
        self.assertEqual(bank.claim_recovery(epoch, "bob"), 0)
        self.assertEqual(bank.claim_protocol(), 6)
        self.assertEqual(bank.active, active_before)
        bank.audit()

    def test_blocked_player_payable_costs_are_charged_once_with_all_other_liabilities(self):
        bank = RecoveryBank(100, {"alice": 100})
        bank.open_hold("old", 10, 20)
        bank.request("alice", "alice", 50)
        epoch = bank.seal()
        active_before = bank.active
        bank.settle("old", net=9, refund=1, pf=2, xp=3, transfer_ok=False)
        self.assertEqual(bank.pockets[epoch].cost, 15)
        self.assertEqual(bank.player_payable["player"], 10)
        self.assertEqual(bank.pf_game, 2)
        self.assertEqual(bank.xp, 3)
        self.assertEqual(bank.active, active_before)
        p_before = bank.p
        self.assertEqual(bank.claim_player("player"), 10)
        self.assertEqual(bank.claim_player("player"), 0)
        self.assertEqual(bank.p, p_before)
        self.assertEqual(bank.pockets[epoch].cost, 15)
        bank.claim_protocol()
        bank.claim_xp()
        self.assertEqual(bank.active, active_before)
        bank.audit()

    def test_snapshot_rights_follow_wallet_owner_and_request_controller_then_stay_fixed(self):
        bank = RecoveryBank(100, {"alice": 60, "bob": 40})
        bank.open_hold("old", 10, 20)
        bank.request("alice", "carol", 20)
        bank.request("bob", "bob", 10)
        epoch = bank.seal()
        self.assertEqual(bank.pockets[epoch].units, {"alice": 40, "bob": 40, "carol": 20})
        bank.transfer("alice", "dave", 40)
        bank.deposit("eve", 10)
        bank.settle("old", refund=10)
        self.assertEqual(bank.claim_liquid(epoch, "carol"), 18)
        self.assertEqual(bank.claim_liquid(epoch, "bob"), 9)
        self.assertEqual(bank.claim_recovery(epoch, "alice"), 4)
        self.assertEqual(bank.claim_recovery(epoch, "bob"), 4)
        self.assertEqual(bank.claim_recovery(epoch, "carol"), 2)
        self.assertEqual(bank.claim_recovery(epoch, "dave"), 0)
        self.assertEqual(bank.claim_recovery(epoch, "eve"), 0)
        bank.open_hold("new", 1, 2)
        bank.request("dave", "dave", 1)
        next_epoch = bank.seal()
        self.assertEqual(bank.pockets[next_epoch].units["dave"], 40)
        self.assertEqual(bank.pockets[epoch].units.get("dave", 0), 0)
        bank.audit()

    def test_cancel_returns_units_to_controller_without_rewriting_earlier_snapshot(self):
        bank = RecoveryBank(100, {"alice": 100})
        bank.open_hold("old", 1, 2)
        bank.request("alice", "alice", 10)
        epoch = bank.seal()
        bank.request("alice", "bob", 20)
        self.assertEqual(bank.cancel("bob"), 20)
        self.assertEqual(bank.wallets["bob"], 20)
        self.assertEqual(bank.pockets[epoch].units["alice"], 100)
        self.assertEqual(bank.pockets[epoch].units.get("bob", 0), 0)
        bank.audit()

    def test_recovery_dust_releases_once_only_after_all_final_units_are_synced(self):
        bank = RecoveryBank(1, {"alice": 1, "bob": 1})
        bank.open_hold("old", 1, 1)
        bank.request("alice", "alice", 1)
        epoch = bank.seal()
        bank.settle("old")
        self.assertEqual(bank.pockets[epoch].recovery, 1)
        self.assertEqual(bank.claim_recovery(epoch, "alice"), 0)
        self.assertEqual(bank.p, 1)
        self.assertEqual(bank.pf_dust, 0)
        bank.final_sync(epoch, "bob")
        self.assertEqual(bank.p, 0)
        self.assertEqual(bank.pf_dust, 1)
        bank.final_sync(epoch, "bob")
        bank.claim_recovery(epoch, "alice")
        self.assertEqual(bank.pf_dust, 1)
        bank.audit()

    def test_full_exit_liquid_rounding_dust_cannot_be_inherited_by_a_new_depositor(self):
        bank = RecoveryBank(1, {"alice": 1, "bob": 1})
        bank.request("alice", "alice", 1)
        bank.request("bob", "bob", 1)
        epoch = bank.seal()
        bank.deposit("new", 10)
        bank.claim_liquid(epoch, "alice")
        bank.claim_liquid(epoch, "bob")
        self.assertEqual(bank.active, 10)
        self.assertEqual(bank.pf_dust, 1)
        bank.audit()

    def test_settlement_order_and_partial_claims_do_not_change_final_recovery(self):
        totals = []
        for order in permutations(range(3)):
            bank = RecoveryBank(80, {"alice": 3, "bob": 4}, offset=2)
            for i in range(3):
                bank.open_hold(i, 2, 10)
            bank.request("alice", "alice", 1)
            epoch = bank.seal()
            for i in order:
                bank.settle(i, net=(1, 5, 9)[i])
                bank.claim_recovery(epoch, "alice")
                bank.audit()
            bank.claim_recovery(epoch, "bob")
            totals.append((bank.pockets[epoch].claimed, bank.pf_virtual, bank.pf_dust, bank.p))
        self.assertTrue(all(value == totals[0] for value in totals))

    def test_combined_cost_rejection_is_atomic_and_does_not_release_old_risk(self):
        bank = RecoveryBank(100, {"alice": 100})
        bank.open_hold("old", 10, 20)
        bank.request("alice", "alice", 50)
        epoch = bank.seal()
        state = (bank.cash, bank.p, bank.active, bank.pf, bank.xp)
        with self.assertRaises(ValueError):
            bank.settle("old", net=10, refund=1, pf=5, xp=5)
        self.assertEqual((bank.cash, bank.p, bank.active, bank.pf, bank.xp), state)
        self.assertTrue(bank.holds["old"].open)
        self.assertEqual(bank.pockets[epoch].cost, 0)
        bank.audit()

    def test_real_pro_rata_reserve_shortcut_overpays_a_new_depositor(self):
        bank = RecoveryBank(199, {"old": 100}, offset=100)
        bank.open_hold("old", 1, 200)
        q = bank.deposit("new", 100)
        self.assertEqual(q, 66)
        bank.request("new", "new", q)
        epoch = bank.seal()
        liquid = bank.claim_liquid(epoch, "new")
        self.assertEqual(liquid, 39)
        wrong_recovery = q * 200 // 166
        self.assertEqual(liquid + wrong_recovery, 118, "an independent Q/S reserve slice creates profit")
        bank.settle("old")
        self.assertEqual(bank.claim_recovery(epoch, "new"), 59)
        self.assertEqual(liquid + bank.pockets[epoch].claimed["new"], 98)
        bank.audit()

    def test_zero_liquid_partial_exit_preserves_old_rights_and_admits_new_capital(self):
        bank = RecoveryBank(0, {"alice": 100})
        bank.open_hold("old", 10, 10)
        bank.request("alice", "alice", 50)
        epoch = bank.seal()
        self.assertEqual(bank.active, 0)
        self.assertEqual(bank.supply, 50)
        self.assertEqual(bank.claim_liquid(epoch, "alice"), 0)
        bank.deposit("bob", 20)
        bank.open_hold("new", 1, 2)
        active_before = bank.active
        bank.settle("old")
        self.assertEqual(bank.claim_recovery(epoch, "alice"), 10)
        self.assertEqual(bank.claim_recovery(epoch, "bob"), 0)
        self.assertEqual(bank.active, active_before)
        bank.audit()

    def test_direct_bank_share_destinations_cannot_create_unowned_snapshot_units(self):
        bank = RecoveryBank(100, {"alice": 100})
        for invalid in (BANK, ZERO):
            with self.assertRaises(ValueError):
                bank.deposit(invalid, 10)
            with self.assertRaises(ValueError):
                bank.transfer("alice", invalid, 10)
        bank.request("alice", "bob", 10)
        epoch = bank.seal()
        self.assertEqual(bank.pockets[epoch].units, {"alice": 90, "bob": 10})
        bank.audit()

    def test_invalid_initial_share_holders_are_rejected_even_for_zero_balances(self):
        for invalid in (BANK, ZERO):
            for shares in (0, 10):
                with self.assertRaises(ValueError):
                    RecoveryBank(100, {"alice": 100 - shares, invalid: shares})

    def test_request_then_cancel_cannot_create_a_bank_or_zero_address_wallet(self):
        for invalid in (BANK, ZERO):
            bank = RecoveryBank(100, {"alice": 100})
            before = (dict(bank.wallets), dict(bank.requests), bank.supply, bank.cash)
            with self.assertRaises(ValueError):
                bank.request("alice", invalid, 10)
            with self.assertRaises(ValueError):
                bank.cancel(invalid)
            self.assertEqual((bank.wallets, bank.requests, bank.supply, bank.cash), before)
            bank.request("alice", "bob", 10)
            self.assertEqual(bank.cancel("bob"), 10)
            self.assertEqual(bank.wallets, {"alice": 90, "bob": 10})
            bank.audit()

    def test_request_then_seal_cannot_give_recovery_units_to_bank_or_zero_address(self):
        for invalid in (BANK, ZERO):
            bank = RecoveryBank(100, {"alice": 100})
            bank.open_hold("old", 1, 2)
            with self.assertRaises(ValueError):
                bank.request("alice", invalid, 10)
            self.assertEqual(bank.wallets, {"alice": 100})
            self.assertEqual(bank.requests, {})
            bank.request("alice", "bob", 10)
            epoch = bank.seal()
            self.assertEqual(bank.pockets[epoch].units, {"alice": 90, "bob": 10})
            self.assertEqual(sum(bank.pockets[epoch].units.values()), 100)
            self.assertNotIn(invalid, bank.pockets[epoch].units)
            self.assertNotIn(invalid, bank.batches[epoch].requests)
            bank.audit()

    def test_fully_reserved_old_epoch_does_not_block_a_second_full_exit_and_recovery(self):
        bank = RecoveryBank(100, {"alice": 100})
        bank.audit()
        bank.open_hold("old", 1, 101)
        bank.audit()
        bank.request("alice", "alice", 100)
        bank.audit()
        old_epoch = bank.seal()
        self.assertEqual((bank.active, bank.supply, bank.p), (0, 0, 101))
        self.assertEqual(bank.batches[old_epoch].assets, 0)
        bank.audit()
        self.assertEqual(bank.claim_liquid(old_epoch, "alice"), 0)
        bank.audit()

        self.assertEqual(bank.deposit("bob", 20), 20)
        bank.audit()
        bank.open_hold("new", 1, 2)
        bank.audit()
        bank.request("bob", "bob", 20)
        bank.audit()
        new_epoch = bank.seal()
        bank.audit()
        self.assertEqual(bank.claim_liquid(new_epoch, "bob"), 19)
        self.assertTrue(bank.holds["old"].open)
        self.assertEqual(bank.pockets[old_epoch].remaining_reserve, 101)
        bank.audit()
        bank.settle("new", net=1)
        bank.audit()
        self.assertEqual(bank.claim_recovery(new_epoch, "bob"), 1)
        bank.audit()
        self.assertEqual(bank.claim_recovery(old_epoch, "bob"), 0)
        bank.audit()

        bank.settle("old")
        bank.audit()
        self.assertEqual(bank.claim_recovery(old_epoch, "alice"), 100)
        self.assertEqual((bank.active, bank.supply, bank.p), (0, 0, 0))
        self.assertEqual(bank.pf_virtual, 1)
        self.assertEqual(bank.pf_game, 0)
        bank.audit()

    def test_final_sync_releases_only_dust_and_preserves_assigned_unclaimed_recoveries(self):
        bank = RecoveryBank(5, {"alice": 2, "bob": 1})
        bank.audit()
        bank.open_hold("old", 1, 5)
        bank.audit()
        bank.request("alice", "alice", 2)
        bank.audit()
        epoch = bank.seal()
        bank.audit()
        bank.settle("old")
        self.assertEqual((bank.pockets[epoch].recovery, bank.p), (4, 4))
        bank.audit()

        bank.final_sync(epoch, "alice")
        self.assertEqual(bank.p, 4)
        bank.audit()
        bank.final_sync(epoch, "bob")
        self.assertEqual(bank.p, 3)
        self.assertEqual(bank.pf_dust, 1)
        self.assertEqual(bank.pockets[epoch].claimed, {})
        bank.audit()
        bank.final_sync(epoch, "alice")
        bank.audit()
        bank.final_sync(epoch, "bob")
        self.assertEqual((bank.p, bank.pf_dust), (3, 1))
        self.assertEqual(bank.pockets[epoch].claimed, {})
        bank.audit()

        bank.deposit("new", 10)
        active_before_claims = bank.active
        bank.audit()
        self.assertEqual(bank.claim_protocol(), 2, "one virtual unit plus one final rounding unit")
        self.assertEqual(bank.active, active_before_claims)
        bank.audit()
        self.assertEqual(bank.claim_recovery(epoch, "alice"), 2)
        self.assertEqual(bank.active, active_before_claims)
        bank.audit()
        self.assertEqual(bank.claim_recovery(epoch, "bob"), 1)
        self.assertEqual(bank.active, active_before_claims)
        bank.audit()
        self.assertEqual(bank.claim_recovery(epoch, "new"), 0)
        self.assertEqual((bank.p, bank.active), (0, active_before_claims))
        bank.audit()

    def test_exhaustive_deposit_then_liquid_and_recovery_exit_cannot_profit_from_old_holds(self):
        count = 0
        for supply in range(1, 7):
            for nav in range(7):
                for offset in range(1, 4):
                    for deposit in range(1, 7):
                        q = deposit * (supply + offset) // (nav + offset)
                        if not q:
                            continue
                        for reserve in range(nav + 1):
                            for cost in range(reserve + 1):
                                bank = RecoveryBank(nav - bool(reserve), {"old": supply}, offset)
                                if reserve:
                                    bank.open_hold("old", 1, reserve)
                                self.assertEqual(bank.deposit("new", deposit), q)
                                bank.request("new", "new", q)
                                epoch = bank.seal()
                                liquid = bank.claim_liquid(epoch, "new")
                                if reserve:
                                    bank.settle("old", net=cost)
                                recovery = bank.claim_recovery(epoch, "new")
                                x = nav + deposit - cost
                                virtual = Fraction(q * (x + offset), supply + q + offset)
                                real = Fraction(q * x, supply + q)
                                old_quote = min(virtual.numerator // virtual.denominator,
                                                real.numerator // real.denominator)
                                self.assertLessEqual(liquid + recovery, old_quote)
                                self.assertLessEqual(virtual, deposit)
                                self.assertLessEqual(liquid + recovery, deposit)
                                bank.audit()
                                count += 1
        self.assertEqual(count, 7_990)


if __name__ == "__main__":
    unittest.main(verbosity=2)
