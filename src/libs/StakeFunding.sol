// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Errors} from "./Errors.sol";

/// @notice Exact, transaction-scoped funding shared by the two betting hubs.
library StakeFunding {
    using SafeERC20 for IERC20;

    function collect(address asset, address bank, uint256 stake) internal returns (uint256 balanceBefore) {
        IERC20 token = IERC20(asset);
        balanceBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), stake);
        if (token.balanceOf(address(this)) != balanceBefore + stake) revert Errors.TransferFailed();
        token.forceApprove(bank, stake);
    }

    function finish(address asset, address bank, uint256 balanceBefore) internal {
        IERC20 token = IERC20(asset);
        token.forceApprove(bank, 0);
        if (token.balanceOf(address(this)) != balanceBefore) revert Errors.TransferFailed();
    }
}
