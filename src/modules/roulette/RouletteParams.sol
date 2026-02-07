// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Roulette bet parameter helpers.
///
/// Two supported encodings (both are forward-compatible):
///
/// (1) Legacy/Raw bitmask (parity with refactored RouletteV2):
///     params = abi.encode(uint40 numbersBitmask)
///
/// (2) Typed bets (UI-friendly). Encoded as:
///     params = abi.encode(uint8 kind, uint40 payload)
///
/// In all cases, the module ultimately resolves into a numbers bitmask for 0..36
/// (European roulette wheel).
library RouletteParams {
    uint8 internal constant MODULO = 37;

    /// @dev Kind values are part of the SSOT public encoding. Do not reorder.
    enum Kind {
        /// @notice Raw numbers bitmask (0..36), stored in `payload`.
        Bitmask,
        /// @notice Straight-up single number (payload = n).
        Straight,
        /// @notice Split bet on 2 numbers (payload packs n0 in bits[0..5], n1 in bits[6..11]).
        Split,
        /// @notice Street bet on a row of 3 (payload = start number, in {1,4,7,...,34}).
        Street,
        /// @notice Corner bet on a 2x2 block (payload = top-left number).
        Corner,
        /// @notice Six-line bet on two adjacent rows (payload = start number, in {1,4,7,...,31}).
        SixLine,
        /// @notice Dozen bet (payload = 1..3).
        Dozen,
        /// @notice Column bet (payload = 1..3).
        Column,
        /// @notice Red (payload ignored).
        Red,
        /// @notice Black (payload ignored).
        Black,
        /// @notice Odd (payload ignored).
        Odd,
        /// @notice Even (payload ignored).
        Even,
        /// @notice Low 1-18 (payload ignored).
        Low,
        /// @notice High 19-36 (payload ignored).
        High
    }

    /// @notice Decode params into a numbers bitmask for 0..36.
    /// @dev Reverts if params are malformed or out of range.
    function decode(bytes calldata params) internal pure returns (uint40 numbers) {
        // Legacy ABI encoding: abi.encode(uint40)
        if (params.length == 32) {
            numbers = abi.decode(params, (uint40));
            return numbers;
        }

        (uint8 kindRaw, uint40 payload) = abi.decode(params, (uint8, uint40));
        Kind kind = Kind(kindRaw);
        numbers = _toBitmask(kind, payload);
    }

    /// @notice Convenience encoder for typed params.
    function encode(Kind kind, uint40 payload) internal pure returns (bytes memory) {
        return abi.encode(uint8(kind), payload);
    }

    /// @notice Convenience encoder for raw bitmask params.
    function encodeBitmask(uint40 numbers) internal pure returns (bytes memory) {
        return abi.encode(numbers);
    }

    // ---------------------------------------------------------------------
    // Typed bet to mask
    // ---------------------------------------------------------------------

    function _toBitmask(Kind kind, uint40 payload) internal pure returns (uint40 numbers) {
        if (kind == Kind.Bitmask) {
            return payload;
        }

        if (kind == Kind.Straight) {
            uint8 n = uint8(payload);
            _requireNumber(n);
            return uint40(1) << n;
        }

        if (kind == Kind.Split) {
            uint8 n0 = uint8(payload & 0x3F);
            uint8 n1 = uint8((payload >> 6) & 0x3F);
            _requireNumber(n0);
            _requireNumber(n1);
            require(n0 != n1, "split=dup");
            return (uint40(1) << n0) | (uint40(1) << n1);
        }

        if (kind == Kind.Street) {
            uint8 s = uint8(payload);
            // Street starts: 1,4,7,...,34
            require(s >= 1 && s <= 34, "street=range");
            require(((s - 1) % 3) == 0, "street=start");
            return (uint40(1) << s) | (uint40(1) << (s + 1)) | (uint40(1) << (s + 2));
        }

        if (kind == Kind.Corner) {
            uint8 n = uint8(payload);
            // top-left of a 2x2 corner: 1..32 and not on rightmost column (3,6,9,...,33,36)
            require(n >= 1 && n <= 32, "corner=range");
            require((n % 3) != 0, "corner=col");
            return (uint40(1) << n)
                | (uint40(1) << (n + 1))
                | (uint40(1) << (n + 3))
                | (uint40(1) << (n + 4));
        }

        if (kind == Kind.SixLine) {
            uint8 s = uint8(payload);
            // Six-line starts: 1,4,7,...,31
            require(s >= 1 && s <= 31, "six=range");
            require(((s - 1) % 3) == 0, "six=start");
            return (uint40(1) << s)
                | (uint40(1) << (s + 1))
                | (uint40(1) << (s + 2))
                | (uint40(1) << (s + 3))
                | (uint40(1) << (s + 4))
                | (uint40(1) << (s + 5));
        }

        if (kind == Kind.Dozen) {
            uint8 d = uint8(payload);
            require(d >= 1 && d <= 3, "dozen=range");
            uint8 start = (d - 1) * 12 + 1;
            return _rangeMask(start, start + 11);
        }

        if (kind == Kind.Column) {
            uint8 c = uint8(payload);
            require(c >= 1 && c <= 3, "col=range");
            // Column 1: 1,4,...,34; Column 2: 2,5,...,35; Column 3: 3,6,...,36
            uint40 m;
            for (uint8 x = c; x <= 36; x += 3) {
                m |= uint40(1) << x;
            }
            return m;
        }

        if (kind == Kind.Red) return redMask();
        if (kind == Kind.Black) return blackMask();
        if (kind == Kind.Odd) return oddMask();
        if (kind == Kind.Even) return evenMask();
        if (kind == Kind.Low) return lowMask();
        if (kind == Kind.High) return highMask();

        revert("kind");
    }

    function _requireNumber(uint8 n) internal pure {
        require(n < MODULO, "n");
    }

    function _rangeMask(uint8 from, uint8 to) internal pure returns (uint40 m) {
        require(from <= to, "range");
        _requireNumber(from);
        _requireNumber(to);
        for (uint8 x = from; x <= to; x++) {
            m |= uint40(1) << x;
        }
    }

    // ---------------------------------------------------------------------
    // Standard outside bets (European)
    // ---------------------------------------------------------------------

    function redMask() internal pure returns (uint40 m) {
        // Red numbers: 1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36
        m |= uint40(1) << 1;
        m |= uint40(1) << 3;
        m |= uint40(1) << 5;
        m |= uint40(1) << 7;
        m |= uint40(1) << 9;
        m |= uint40(1) << 12;
        m |= uint40(1) << 14;
        m |= uint40(1) << 16;
        m |= uint40(1) << 18;
        m |= uint40(1) << 19;
        m |= uint40(1) << 21;
        m |= uint40(1) << 23;
        m |= uint40(1) << 25;
        m |= uint40(1) << 27;
        m |= uint40(1) << 30;
        m |= uint40(1) << 32;
        m |= uint40(1) << 34;
        m |= uint40(1) << 36;
    }

    function blackMask() internal pure returns (uint40) {
        // black = {1..36} \ red
        uint40 wheel = (uint40(1) << MODULO) - 1; // bits 0..36 set
        uint40 nonZero = wheel & ~uint40(1); // clear 0
        return nonZero & (wheel ^ redMask());
    }

    function oddMask() internal pure returns (uint40 m) {
        for (uint8 x = 1; x <= 35; x += 2) {
            m |= uint40(1) << x;
        }
    }

    function evenMask() internal pure returns (uint40 m) {
        for (uint8 x = 2; x <= 36; x += 2) {
            m |= uint40(1) << x;
        }
    }

    function lowMask() internal pure returns (uint40) {
        return _rangeMask(1, 18);
    }

    function highMask() internal pure returns (uint40) {
        return _rangeMask(19, 36);
    }
}
