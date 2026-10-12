// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @dev Configuration mock only: these tests do not claim to prove actual Safe quorum or signature execution. `exec`
///      lets the account that created the mock act as the multisig, so scheduling and cancelling can be broadcast to a
///      local chain by the release fixtures.
///
///      This file has no imports and deploys no contract, so the mock has one runtime code in every compilation.
///      Forge's dynamic test linking rewrites a test file that deploys src contracts with `new`, naming helpers after
///      the compilation, and runtime code ends in the metadata hash of the contract's file and imports. Defined in such
///      a file, the mock changed its code hash whenever another compilation rebuilt it, while the release import test
///      deploys it to two nodes in separate Forge runs and checks one signed code hash on both
///      (test/ops/test_manifest_authentication.py).
contract SafeConfigMockV16 {
    address internal immutable operator;
    address[] internal owners;
    uint256 internal threshold = 2;
    address public guard;
    bool public moduleEnabled;

    constructor(uint160 firstOwner) {
        operator = msg.sender;
        for (uint160 i; i < 3; ++i) {
            owners.push(address(firstOwner + i));
        }
    }

    function exec(address target, bytes calldata data) external returns (bytes memory result) {
        require(msg.sender == operator, "not the mock operator");
        bool ok;
        (ok, result) = target.call(data);
        if (!ok) {
            assembly ("memory-safe") {
                revert(add(result, 32), mload(result))
            }
        }
    }

    function setGuard(address value) external {
        guard = value;
    }

    function setModule() external {
        moduleEnabled = true;
    }

    function setOwners(address[] calldata owners_, uint256 threshold_) external {
        owners = owners_;
        threshold = threshold_;
    }

    function getStorageAt(uint256 slot, uint256) external view returns (bytes memory) {
        if (slot == 0) return abi.encode(address(this));
        if (slot == uint256(keccak256("guard_manager.guard.address"))) return abi.encode(guard);
        return abi.encode(address(0));
    }

    function getOwners() external view returns (address[] memory) {
        return owners;
    }

    function getThreshold() external view returns (uint256) {
        return threshold;
    }

    function getModulesPaginated(address, uint256) external view returns (address[] memory modules, address next) {
        modules = new address[](moduleEnabled ? 1 : 0);
        if (moduleEnabled) modules[0] = address(99);
        return (modules, address(1));
    }

    /// The control hash SafeGovernance computes for this mock: it is its own singleton, with no guard or fallback.
    function controlHash() external view returns (bytes32) {
        return keccak256(abi.encode(address(this), address(this).codehash, address(0), address(0), bytes32(0)));
    }

    function ownersHash() external view returns (bytes32) {
        return keccak256(abi.encode(owners, threshold));
    }
}
