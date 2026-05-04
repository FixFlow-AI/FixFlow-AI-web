// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FixFlowEscrow is AccessControl, Pausable {
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    enum EscrowState { CREATED, FUNDED, MILESTONE_SUBMITTED, MILESTONE_APPROVED, DISPUTED, RESOLVED, RELEASED, CANCELLED }

    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event MilestoneApproved(uint256 indexed escrowId, uint256 indexed milestoneId, uint256 amount);
    event EscrowDisputed(uint256 indexed escrowId, bytes32 evidenceHash);

    constructor(address admin, address arbitrator) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ARBITRATOR_ROLE, arbitrator);
    }
}
