// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISafeGovernance {
    function getStorageAt(uint256 offset, uint256 length) external view returns (bytes memory);
    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
    function getModulesPaginated(address start, uint256 pageSize) external view returns (address[] memory, address);
}

/// @dev Binds deployment to a reviewed Safe proxy and owner configuration.
/// The control hash pins singleton and fallback bytecode; this release requires no transaction guard.
library SafeGovernance {
    function controlHash(address safe) internal view returns (bytes32) {
        // Safe 1.4.1 GuardManager/FallbackManager storage slots; source links are in the deployment runbook.
        address singleton = abi.decode(ISafeGovernance(safe).getStorageAt(0, 1), (address));
        address guard = abi.decode(
            ISafeGovernance(safe).getStorageAt(uint256(keccak256("guard_manager.guard.address")), 1), (address)
        );
        address fallbackHandler = abi.decode(
            ISafeGovernance(safe).getStorageAt(uint256(keccak256("fallback_manager.handler.address")), 1), (address)
        );
        require(singleton.code.length != 0, "Safe singleton has no code");
        require(guard == address(0), "Safe guard not allowed");
        require(fallbackHandler == address(0) || fallbackHandler.code.length != 0, "Safe fallback has no code");
        return keccak256(
            abi.encode(
                singleton,
                singleton.codehash,
                guard,
                fallbackHandler,
                fallbackHandler == address(0) ? bytes32(0) : fallbackHandler.codehash
            )
        );
    }

    function validate(address safe, bytes32 ownersHash, bytes32 codeHash, bytes32 expectedControls) internal view {
        require(safe.code.length != 0 && codeHash != bytes32(0) && safe.codehash == codeHash, "Safe code mismatch");
        address[] memory owners = ISafeGovernance(safe).getOwners();
        uint256 threshold = ISafeGovernance(safe).getThreshold();
        require(owners.length == 3 && threshold == 2, "2-of-3 Safe required");
        for (uint256 i; i < owners.length; ++i) {
            require(owners[i] != address(0) && owners[i] != address(1) && owners[i] != safe, "invalid Safe owner");
            for (uint256 j; j < i; ++j) {
                require(owners[i] != owners[j], "duplicate Safe owner");
            }
        }
        require(ownersHash == keccak256(abi.encode(owners, threshold)), "Safe owners mismatch");
        (address[] memory modules, address next) = ISafeGovernance(safe).getModulesPaginated(address(1), 1);
        require(modules.length == 0 && next == address(1), "Safe modules not allowed");
        require(controlHash(safe) == expectedControls, "Safe controls mismatch");
    }
}
