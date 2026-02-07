// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library Math {
    function mulDiv(uint256 a, uint256 b, uint256 denom) internal pure returns (uint256 result) {
        unchecked {
            uint256 prod0;
            uint256 prod1;
            assembly {
                let mm := mulmod(a, b, not(0))
                prod0 := mul(a, b)
                prod1 := sub(sub(mm, prod0), lt(mm, prod0))
            }
            if (prod1 == 0) {
                return prod0 / denom;
            }
            require(denom > prod1, "mulDiv overflow");
            uint256 remainder;
            assembly {
                remainder := mulmod(a, b, denom)
                prod1 := sub(prod1, gt(remainder, prod0))
                prod0 := sub(prod0, remainder)
            }
            uint256 twos = denom & (~denom + 1);
            assembly {
                denom := div(denom, twos)
                prod0 := div(prod0, twos)
                twos := add(div(sub(0, twos), twos), 1)
            }
            prod0 |= prod1 * twos;
            uint256 inv = (3 * denom) ^ 2;
            inv *= 2 - denom * inv;
            inv *= 2 - denom * inv;
            inv *= 2 - denom * inv;
            inv *= 2 - denom * inv;
            inv *= 2 - denom * inv;
            inv *= 2 - denom * inv;
            result = prod0 * inv;
            return result;
        }
    }

    function mulDivUp(uint256 a, uint256 b, uint256 denom) internal pure returns (uint256) {
        uint256 x = mulDiv(a, b, denom);
        unchecked { if (mulmod(a,b,denom) > 0) x += 1; }
        return x;
    }
}
