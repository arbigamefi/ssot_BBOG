// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import "forge-std/Test.sol";
import {RouletteParams} from "../../src/modules/roulette/RouletteParams.sol";

contract RouletteParamsTest is Test {
    function decode(bytes calldata params) external pure returns (uint40) {
        return RouletteParams.decode(params);
    }

    function test_scalarCanonicalBoundsKeepTheirMasks() external view {
        assertEq(_decode(RouletteParams.Kind.Straight, 0), 1);
        assertEq(_decode(RouletteParams.Kind.Straight, 36), uint40(1) << 36);
        assertEq(_decode(RouletteParams.Kind.Street, 1), uint40(7) << 1);
        assertEq(_decode(RouletteParams.Kind.Street, 34), uint40(7) << 34);
        assertEq(_decode(RouletteParams.Kind.Corner, 1), uint40(27) << 1);
        assertEq(_decode(RouletteParams.Kind.Corner, 32), uint40(27) << 32);
        assertEq(_decode(RouletteParams.Kind.SixLine, 1), uint40(63) << 1);
        assertEq(_decode(RouletteParams.Kind.SixLine, 31), uint40(63) << 31);
        assertEq(_decode(RouletteParams.Kind.Dozen, 1), uint40(4095) << 1);
        assertEq(_decode(RouletteParams.Kind.Dozen, 3), uint40(4095) << 25);
        assertEq(_decode(RouletteParams.Kind.Column, 1), uint40(0x249249249) << 1);
        assertEq(_decode(RouletteParams.Kind.Column, 3), uint40(0x249249249) << 3);
    }

    function test_scalarRejects255256257BeforeNarrowing() external {
        for (uint8 kind = uint8(RouletteParams.Kind.Straight); kind <= uint8(RouletteParams.Kind.Column); ++kind) {
            if (kind == uint8(RouletteParams.Kind.Split)) continue;
            for (uint40 payload = 255; payload <= 257; ++payload) {
                vm.expectRevert();
                this.decode(RouletteParams.encode(RouletteParams.Kind(kind), payload));
            }
        }
    }

    function test_scalarRejectsEveryHighBitBeforeNarrowing() external {
        for (uint8 kind = uint8(RouletteParams.Kind.Straight); kind <= uint8(RouletteParams.Kind.Column); ++kind) {
            if (kind == uint8(RouletteParams.Kind.Split)) continue;
            for (uint8 bit = 8; bit < 40; ++bit) {
                vm.expectRevert();
                this.decode(RouletteParams.encode(RouletteParams.Kind(kind), (uint40(1) << bit) | 1));
            }
        }
    }

    function test_splitPreservesCanonicalPacked256And257() external view {
        assertEq(_decode(RouletteParams.Kind.Split, 256), (uint40(1) << 0) | (uint40(1) << 4));
        assertEq(_decode(RouletteParams.Kind.Split, 257), (uint40(1) << 1) | (uint40(1) << 4));
        assertEq(_decode(RouletteParams.Kind.Split, uint40(36) << 6), 1 | (uint40(1) << 36));
    }

    function test_splitRejects255AndInvalidPackedNumbers() external {
        uint40[3] memory payloads = [uint40(255), uint40(37) << 6, uint40(1) | (uint40(1) << 6)];
        for (uint256 i; i < payloads.length; ++i) {
            vm.expectRevert();
            this.decode(RouletteParams.encode(RouletteParams.Kind.Split, payloads[i]));
        }
    }

    function test_splitRejectsEveryUnusedHighBit() external {
        for (uint8 bit = 12; bit < 40; ++bit) {
            vm.expectRevert("split=range");
            this.decode(RouletteParams.encode(RouletteParams.Kind.Split, (uint40(1) << bit) | 257));
        }
    }

    function test_bitmaskAndIgnoredOutsidePayloadsRemainUnchanged() external view {
        uint40 mask = 1 | (uint40(1) << 36);
        assertEq(_decode(RouletteParams.Kind.Bitmask, mask), mask);
        for (uint8 kind = uint8(RouletteParams.Kind.Red); kind <= uint8(RouletteParams.Kind.High); ++kind) {
            assertEq(_decode(RouletteParams.Kind(kind), type(uint40).max), _decode(RouletteParams.Kind(kind), 0));
        }
    }

    function _decode(RouletteParams.Kind kind, uint40 payload) internal view returns (uint40) {
        return this.decode(RouletteParams.encode(kind, payload));
    }
}
