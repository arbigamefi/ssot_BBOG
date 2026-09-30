"""Integer oracle: only exiting capital receives fixed historical risk units.

Each unit is one unit of an original hold's reserve. A batch buys a fixed share
of every active hold at the same maximum-equity fraction. The oracle enumerates
all allocations to independently reconcile Bank's lazy assignment. It does not
implement token transfers, authorization or gas bounds; Solidity tests cover those.
"""
from dataclasses import dataclass, field
import random
import unittest


@dataclass
class Hold:
    reserve: int
    active: int
    protocol: int = 0
    cost: int | None = None
    allocations: dict[int, int] = field(default_factory=dict)


@dataclass
class Exit:
    cash: int
    shares: int
    allocations: dict[int, int]
    recovery_claimed: int = 0


class Book:
    def __init__(self, offset=1000):
        self.offset = offset
        self.cash = self.nav = self.supply = self.protocol = self.payable = 0
        self.wallets = {}
        self.holds = {}
        self.exits = {}
        self.assigned = set()
        self.dust_holds = set()
        self.dust_paid = 0

    @property
    def reserve(self):
        return sum(h.active for h in self.holds.values() if h.cost is None)

    def deposit(self, owner, assets):
        shares = assets * (self.supply + self.offset) // (self.nav + self.offset)
        if not shares:
            raise ValueError('zero shares')
        self.cash += assets; self.nav += assets; self.supply += shares
        self.wallets[owner] = self.wallets.get(owner, 0) + shares
        self.audit()
        return shares

    def hold(self, id, stake, reserve):
        assert id not in self.holds and reserve >= stake > 0
        assert self.nav + stake >= self.reserve + reserve
        self.cash += stake; self.nav += stake
        self.holds[id] = Hold(reserve, reserve)
        self.audit()

    def activate(self, owner, shares):
        assert 0 < shares <= self.wallets[owner]
        n, s, r = self.nav, self.supply, self.reserve
        g = min(s * (n + self.offset) // (s + self.offset), n)
        equity = shares * g // s
        liquid = equity * (n - r) // n if n else 0
        allocations = {}
        epoch = len(self.exits) + 1
        for id, hold in self.holds.items():
            if hold.cost is not None:
                continue
            units = hold.active * equity // n if n else 0
            hold.active -= units
            if units:
                hold.allocations[epoch] = allocations[id] = units
            if shares == s:
                hold.protocol += hold.active
                hold.active = 0
        risk = sum(allocations.values())
        self.nav -= liquid + risk
        if shares == s:
            self.nav -= r - risk
            self.protocol += self.nav
            self.nav = 0
        self.exits[epoch] = Exit(liquid, shares, allocations)
        self.wallets[owner] -= shares; self.supply -= shares
        self.audit()
        return epoch

    def settle(self, id, cost, refused=False):
        hold = self.holds[id]
        assert hold.cost is None and 0 <= cost <= hold.reserve
        hold.cost = cost
        self.nav -= hold.active * cost // hold.reserve
        if refused:
            self.payable += cost
        else:
            self.cash -= cost
        inactive = hold.reserve - hold.active
        exit_units = inactive - hold.protocol
        released = hold.reserve - cost
        self.protocol += inactive * released // hold.reserve - exit_units * released // hold.reserve
        self.audit()

    def recovery(self, epoch):
        return sum(units * (self.holds[id].reserve - self.holds[id].cost) // self.holds[id].reserve
                   for id, units in self.exits[epoch].allocations.items() if self.holds[id].cost is not None)

    def sync(self, epoch):
        if any(self.holds[id].cost is None for id in self.exits[epoch].allocations):
            return
        self.assigned.add(epoch)
        for id in self.exits[epoch].allocations:
            hold = self.holds[id]
            if id in self.dust_holds or not set(hold.allocations).issubset(self.assigned):
                continue
            released = hold.reserve - hold.cost
            summed = sum(units * released // hold.reserve for units in hold.allocations.values())
            dust = sum(hold.allocations.values()) * released // hold.reserve - summed
            self.dust_paid += dust; self.protocol += dust; self.dust_holds.add(id)
        self.audit()

    def claim(self, epoch):
        self.sync(epoch)
        item = self.exits[epoch]
        recovery = self.recovery(epoch)
        amount = item.cash + recovery - item.recovery_claimed
        self.cash -= amount; item.cash = 0; item.recovery_claimed = recovery
        self.audit()
        return amount

    def pay_player(self):
        self.cash -= self.payable; self.payable = 0
        self.audit()

    def backing(self):
        # Reconcile from original hold ownership, not running Bank counters.
        total = 0
        for hold in self.holds.values():
            inactive = hold.reserve - hold.active
            if hold.cost is None:
                total += inactive
            else:
                total += (inactive - hold.protocol) * (hold.reserve - hold.cost) // hold.reserve
        return total - sum(e.recovery_claimed for e in self.exits.values()) - self.dust_paid

    def audit(self):
        assert self.cash == self.nav + self.protocol + self.payable + self.backing() + sum(e.cash for e in self.exits.values())
        assert self.nav >= self.reserve >= 0
        assert self.supply == sum(self.wallets.values())
        for hold in self.holds.values():
            assert hold.active + hold.protocol + sum(hold.allocations.values()) == hold.reserve
        # Aggregate backing includes pending obligations and the cross-batch floor remainder.
        claims = sum(self.recovery(epoch) - item.recovery_claimed for epoch, item in self.exits.items())
        pending = sum(h.reserve - h.active for h in self.holds.values() if h.cost is None)
        assert self.backing() >= pending + claims


class RecoveryPocketTests(unittest.TestCase):
    def test_repeated_dust_exits_restore_staying_capacity_without_claim_or_reinvestment(self):
        book = Book(); book.deposit('stayer', 100_000_000); book.deposit('exiter', 1000)
        for id in range(20):
            book.hold(id, 20_000_000, 40_000_000)
            epoch = book.activate('exiter', 50)
            book.settle(id, 20_000_000)
            self.assertGreaterEqual(book.nav, 100_000_000)
            self.assertEqual(book.reserve, 0)
            book.claim(epoch)

    def test_old_hold_survives_overlapping_exits_and_new_deposits(self):
        book = Book(); book.deposit('a', 100_000); book.deposit('b', 100_000)
        book.hold(1, 20_000, 40_000)
        first = book.activate('a', 50_000)
        original_units = book.exits[first].allocations[1]
        original_cash = book.exits[first].cash
        book.deposit('new', 100_000)
        second = book.activate('b', 50_000)
        self.assertEqual(book.exits[first].allocations[1], original_units)
        book.settle(1, 10_000)
        self.assertEqual(book.claim(first), original_cash + original_units * 30_000 // 40_000)
        self.assertGreater(book.claim(second), 0)

    def test_full_exit_separates_old_risk_from_fresh_capital(self):
        book = Book(); shares = book.deposit('a', 100_000); book.hold(1, 20_000, 40_000)
        epoch = book.activate('a', shares); book.claim(epoch)
        self.assertEqual(book.nav, 0)
        book.deposit('new', 100_000)
        book.activate('new', 50_000)
        book.activate('new', 50_000)
        book.deposit('later', 100_000)
        book.settle(1, 10_000)
        self.assertEqual(book.nav, 100_000)
        self.assertGreater(book.claim(epoch), 0)

    def test_payout_refusal_does_not_change_any_lp_entitlement_or_value(self):
        outcomes = []
        for refused in (False, True):
            book = Book(); book.deposit('a', 100_000); book.hold(1, 20_000, 40_000)
            epoch = book.activate('a', 40_000)
            book.settle(1, 30_000, refused)
            outcomes.append((book.nav, book.recovery(epoch), book.backing(), book.protocol))
            book.pay_player(); book.claim(epoch)
        self.assertEqual(*outcomes)

    def test_exhaustive_small_values_never_reward_exiting_before_a_known_cost(self):
        for supply in range(1, 9):
            for nav in range(1, 16):
                for offset in (1, 3, 1000):
                    for reserve in range(1, nav + 1):
                        for q in range(1, supply + 1):
                            g = min(supply * (nav + offset) // (supply + offset), nav)
                            equity = q * g // supply
                            cash = equity * (nav - reserve) // nav
                            units = reserve * equity // nav
                            for cost in range(reserve + 1):
                                actual = cash + units * (reserve - cost) // reserve
                                after = min(supply * (nav - cost + offset) // (supply + offset), nav - cost)
                                # Compare actual economic ownership, not the extra floor from first
                                # rounding the WHOLE real-supply quote and then the user's share.
                                direct = min(q * (nav - cost + offset) // (supply + offset), q * (nav - cost) // supply)
                                self.assertLessEqual(actual, direct)
                                self.assertLessEqual(actual, q * after // supply + 1)

    def test_random_interleavings_conserve_cash_and_all_risk_units(self):
        for seed in range(100):
            rng = random.Random(seed); book = Book()
            book.deposit('a', 1_000_000); book.deposit('b', 1_000_000)
            next_hold = 0
            for _ in range(100):
                action = rng.randrange(5)
                if action == 0:
                    book.deposit(rng.choice(('a', 'b', 'c')), rng.randrange(1000, 10_000))
                elif action == 1 and book.nav - book.reserve >= 20_000:
                    book.hold(next_hold, 10_000, 20_000); next_hold += 1
                elif action == 2:
                    owner = rng.choice(('a', 'b', 'c')); balance = book.wallets.get(owner, 0)
                    if balance:
                        book.activate(owner, rng.randrange(1, balance + 1))
                elif action == 3:
                    opened = [id for id, h in book.holds.items() if h.cost is None]
                    if opened:
                        id = rng.choice(opened); book.settle(id, rng.randrange(book.holds[id].reserve + 1))
                elif book.exits:
                    book.claim(rng.choice(list(book.exits)))
                book.audit()
            for id, hold in book.holds.items():
                if hold.cost is None: book.settle(id, rng.randrange(hold.reserve + 1))
            for epoch in book.exits: book.claim(epoch)
            self.assertEqual(book.backing(), 0, 'final synchronization cannot leave ownerless dust')


if __name__ == '__main__':
    unittest.main()
