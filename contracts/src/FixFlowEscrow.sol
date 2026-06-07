// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract FixFlowEscrow is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant ARBITRATOR_ROLE = keccak256("ARBITRATOR_ROLE");

    enum EscrowState {
        CREATED,
        FUNDED,
        MILESTONE_SUBMITTED,
        MILESTONE_APPROVED,
        DISPUTED,
        RESOLVED,
        RELEASED,
        CANCELLED
    }

    struct Milestone {
        uint256 amount;
        bool submitted;
        bool approved;
    }

    struct EscrowDetails {
        address buyer;
        address seller;
        IERC20 token;
        uint256 totalAmount;
        uint256 releasedAmount;
        EscrowState state;
        uint256 milestoneCount;
    }

    uint256 public nextEscrowId;
    mapping(uint256 => EscrowDetails) public escrows;
    // escrowId => milestoneId => Milestone
    mapping(uint256 => mapping(uint256 => Milestone)) public escrowMilestones;

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        address token,
        uint256 totalAmount
    );
    event EscrowFunded(uint256 indexed escrowId, uint256 amount);
    event MilestoneSubmitted(uint256 indexed escrowId, uint256 indexed milestoneId);
    event MilestoneApproved(uint256 indexed escrowId, uint256 indexed milestoneId, uint256 amount);
    event EscrowDisputed(uint256 indexed escrowId, bytes32 evidenceHash);
    event DisputeResolved(uint256 indexed escrowId, uint256 buyerAmount, uint256 sellerAmount);
    event EscrowCancelled(uint256 indexed escrowId);

    modifier onlyBuyer(uint256 escrowId) {
        require(escrows[escrowId].buyer == msg.sender, "Only buyer can perform this action");
        _;
    }

    modifier onlySeller(uint256 escrowId) {
        require(escrows[escrowId].seller == msg.sender, "Only seller can perform this action");
        _;
    }

    modifier inState(uint256 escrowId, EscrowState expectedState) {
        require(escrows[escrowId].state == expectedState, "Invalid escrow state");
        _;
    }

    constructor(address admin, address arbitrator) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ARBITRATOR_ROLE, arbitrator);
    }

    function createEscrow(
        address buyer,
        address seller,
        address token,
        uint256[] calldata milestoneAmounts
    ) external whenNotPaused returns (uint256) {
        require(buyer != address(0), "Invalid buyer address");
        require(seller != address(0), "Invalid seller address");
        require(token != address(0), "Invalid token address");
        require(milestoneAmounts.length > 0, "Milestones required");
        require(milestoneAmounts.length <= 10, "Too many milestones");

        uint256 escrowId = nextEscrowId++;
        uint256 totalAmount = 0;

        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            require(milestoneAmounts[i] > 0, "Milestone amount must be positive");
            escrowMilestones[escrowId][i] = Milestone({
                amount: milestoneAmounts[i],
                submitted: false,
                approved: false
            });
            totalAmount += milestoneAmounts[i];
        }

        escrows[escrowId] = EscrowDetails({
            buyer: buyer,
            seller: seller,
            token: IERC20(token),
            totalAmount: totalAmount,
            releasedAmount: 0,
            state: EscrowState.CREATED,
            milestoneCount: milestoneAmounts.length
        });

        emit EscrowCreated(escrowId, buyer, seller, token, totalAmount);
        return escrowId;
    }

    function fundEscrow(uint256 escrowId) external whenNotPaused inState(escrowId, EscrowState.CREATED) {
        EscrowDetails storage escrow = escrows[escrowId];
        require(msg.sender == escrow.buyer, "Only buyer can fund the escrow");

        escrow.state = EscrowState.FUNDED;
        
        // Transfer tokens from buyer to this contract
        require(
            escrow.token.transferFrom(escrow.buyer, address(this), escrow.totalAmount),
            "Token transfer failed"
        );

        emit EscrowFunded(escrowId, escrow.totalAmount);
    }

    function submitMilestone(
        uint256 escrowId,
        uint256 milestoneId
    ) external whenNotPaused onlySeller(escrowId) {
        EscrowDetails storage escrow = escrows[escrowId];
        require(
            escrow.state == EscrowState.FUNDED || escrow.state == EscrowState.MILESTONE_APPROVED,
            "Invalid state for milestone submission"
        );
        require(milestoneId < escrow.milestoneCount, "Milestone does not exist");
        
        Milestone storage milestone = escrowMilestones[escrowId][milestoneId];
        require(!milestone.submitted, "Milestone already submitted");
        require(!milestone.approved, "Milestone already approved");

        milestone.submitted = true;
        escrow.state = EscrowState.MILESTONE_SUBMITTED;

        emit MilestoneSubmitted(escrowId, milestoneId);
    }

    function approveMilestone(
        uint256 escrowId,
        uint256 milestoneId
    ) external whenNotPaused nonReentrant {
        EscrowDetails storage escrow = escrows[escrowId];
        require(
            msg.sender == escrow.buyer || hasRole(ARBITRATOR_ROLE, msg.sender),
            "Only buyer or arbitrator can approve"
        );
        require(escrow.state == EscrowState.MILESTONE_SUBMITTED, "No milestone submitted");
        require(milestoneId < escrow.milestoneCount, "Milestone does not exist");

        Milestone storage milestone = escrowMilestones[escrowId][milestoneId];
        require(milestone.submitted, "Milestone not submitted");
        require(!milestone.approved, "Milestone already approved");

        milestone.approved = true;
        escrow.releasedAmount += milestone.amount;

        // Check if all milestones are approved
        bool allApproved = true;
        for (uint256 i = 0; i < escrow.milestoneCount; i++) {
            if (!escrowMilestones[escrowId][i].approved) {
                allApproved = false;
                break;
            }
        }

        if (allApproved) {
            escrow.state = EscrowState.RELEASED;
        } else {
            escrow.state = EscrowState.MILESTONE_APPROVED;
        }

        // Transfer funds to the seller
        require(escrow.token.transfer(escrow.seller, milestone.amount), "Token transfer failed");

        emit MilestoneApproved(escrowId, milestoneId, milestone.amount);
    }

    function disputeEscrow(
        uint256 escrowId,
        bytes32 evidenceHash
    ) external whenNotPaused {
        EscrowDetails storage escrow = escrows[escrowId];
        require(
            msg.sender == escrow.buyer || msg.sender == escrow.seller,
            "Only buyer or seller can dispute"
        );
        require(
            escrow.state == EscrowState.FUNDED ||
            escrow.state == EscrowState.MILESTONE_SUBMITTED ||
            escrow.state == EscrowState.MILESTONE_APPROVED,
            "Cannot dispute in current state"
        );

        escrow.state = EscrowState.DISPUTED;
        emit EscrowDisputed(escrowId, evidenceHash);
    }

    function resolveDispute(
        uint256 escrowId,
        uint256 buyerAmount,
        uint256 sellerAmount
    ) external onlyRole(ARBITRATOR_ROLE) whenNotPaused nonReentrant inState(escrowId, EscrowState.DISPUTED) {
        EscrowDetails storage escrow = escrows[escrowId];
        uint256 remainingFunds = escrow.totalAmount - escrow.releasedAmount;
        require(buyerAmount + sellerAmount == remainingFunds, "Resolution amounts must equal remaining funds");

        escrow.state = EscrowState.RESOLVED;

        if (buyerAmount > 0) {
            require(escrow.token.transfer(escrow.buyer, buyerAmount), "Buyer transfer failed");
        }
        if (sellerAmount > 0) {
            require(escrow.token.transfer(escrow.seller, sellerAmount), "Seller transfer failed");
        }

        emit DisputeResolved(escrowId, buyerAmount, sellerAmount);
    }

    function cancelEscrow(uint256 escrowId) external whenNotPaused inState(escrowId, EscrowState.CREATED) {
        EscrowDetails storage escrow = escrows[escrowId];
        require(
            msg.sender == escrow.buyer || hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Only buyer or admin can cancel"
        );

        escrow.state = EscrowState.CANCELLED;
        emit EscrowCancelled(escrowId);
    }

    // Admin commands
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
