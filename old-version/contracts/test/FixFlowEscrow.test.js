const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FixFlowEscrow", function () {
  let escrow, token;
  let admin, arbitrator, buyer, seller;

  beforeEach(async function () {
    [admin, arbitrator, buyer, seller] = await ethers.getSigners();

    // Deploy Mock Token
    const TokenFactory = await ethers.getContractFactory("MockERC20");
    token = await TokenFactory.deploy("Mock USDC", "mUSDC", ethers.parseEther("100000"));
    await token.waitForDeployment();

    // Mint tokens to buyer
    await token.mint(buyer.address, ethers.parseEther("10000"));

    // Deploy Escrow
    const EscrowFactory = await ethers.getContractFactory("FixFlowEscrow");
    escrow = await EscrowFactory.deploy(admin.address, arbitrator.address);
    await escrow.waitForDeployment();
  });

  describe("Deployment", function () {
    it("should set correct roles", async function () {
      const DEFAULT_ADMIN_ROLE = await escrow.DEFAULT_ADMIN_ROLE();
      const ARBITRATOR_ROLE = await escrow.ARBITRATOR_ROLE();

      expect(await escrow.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await escrow.hasRole(ARBITRATOR_ROLE, arbitrator.address)).to.be.true;
      expect(await escrow.hasRole(ARBITRATOR_ROLE, buyer.address)).to.be.false;
    });
  });

  describe("Escrow Creation & Funding", function () {
    it("should create escrow in CREATED state", async function () {
      const milestoneAmounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      const tx = await escrow.createEscrow(buyer.address, seller.address, await token.getAddress(), milestoneAmounts);
      const receipt = await tx.wait();

      // Get event details
      const filter = escrow.filters.EscrowCreated;
      const events = await escrow.queryFilter(filter, receipt.blockNumber);
      expect(events.length).to.equal(1);
      const escrowId = events[0].args.escrowId;

      const details = await escrow.escrows(escrowId);
      expect(details.buyer).to.equal(buyer.address);
      expect(details.seller).to.equal(seller.address);
      expect(details.totalAmount).to.equal(ethers.parseEther("300"));
      expect(details.state).to.equal(0); // EscrowState.CREATED
    });

    it("should allow buyer to fund escrow", async function () {
      const milestoneAmounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      await escrow.createEscrow(buyer.address, seller.address, await token.getAddress(), milestoneAmounts);
      const escrowId = 0;

      // Approve contract to spend buyer tokens
      await token.connect(buyer).approve(await escrow.getAddress(), ethers.parseEther("300"));

      // Fund
      await expect(escrow.connect(buyer).fundEscrow(escrowId))
        .to.emit(escrow, "EscrowFunded")
        .withArgs(escrowId, ethers.parseEther("300"));

      const details = await escrow.escrows(escrowId);
      expect(details.state).to.equal(1); // EscrowState.FUNDED
      expect(await token.balanceOf(await escrow.getAddress())).to.equal(ethers.parseEther("300"));
    });

    it("should reject funding from non-buyer", async function () {
      const milestoneAmounts = [ethers.parseEther("100")];
      await escrow.createEscrow(buyer.address, seller.address, await token.getAddress(), milestoneAmounts);
      await token.connect(buyer).approve(await escrow.getAddress(), ethers.parseEther("100"));

      await expect(escrow.connect(seller).fundEscrow(0)).to.be.revertedWith("Only buyer can fund the escrow");
    });
  });

  describe("Milestone Submission & Approval", function () {
    let escrowId = 0;

    beforeEach(async function () {
      const milestoneAmounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      await escrow.createEscrow(buyer.address, seller.address, await token.getAddress(), milestoneAmounts);
      await token.connect(buyer).approve(await escrow.getAddress(), ethers.parseEther("300"));
      await escrow.connect(buyer).fundEscrow(escrowId);
    });

    it("should allow seller to submit milestone", async function () {
      await expect(escrow.connect(seller).submitMilestone(escrowId, 0))
        .to.emit(escrow, "MilestoneSubmitted")
        .withArgs(escrowId, 0);

      const details = await escrow.escrows(escrowId);
      expect(details.state).to.equal(2); // EscrowState.MILESTONE_SUBMITTED

      const milestone = await escrow.escrowMilestones(escrowId, 0);
      expect(milestone.submitted).to.be.true;
    });

    it("should allow buyer to approve milestone", async function () {
      await escrow.connect(seller).submitMilestone(escrowId, 0);

      const sellerInitialBalance = await token.balanceOf(seller.address);

      await expect(escrow.connect(buyer).approveMilestone(escrowId, 0))
        .to.emit(escrow, "MilestoneApproved")
        .withArgs(escrowId, 0, ethers.parseEther("100"));

      const sellerFinalBalance = await token.balanceOf(seller.address);
      expect(sellerFinalBalance - sellerInitialBalance).to.equal(ethers.parseEther("100"));

      const details = await escrow.escrows(escrowId);
      expect(details.state).to.equal(3); // EscrowState.MILESTONE_APPROVED
      expect(details.releasedAmount).to.equal(ethers.parseEther("100"));
    });

    it("should transition to RELEASED state when all milestones are approved", async function () {
      await escrow.connect(seller).submitMilestone(escrowId, 0);
      await escrow.connect(buyer).approveMilestone(escrowId, 0);

      await escrow.connect(seller).submitMilestone(escrowId, 1);
      await expect(escrow.connect(buyer).approveMilestone(escrowId, 1))
        .to.emit(escrow, "MilestoneApproved")
        .withArgs(escrowId, 1, ethers.parseEther("200"));

      const details = await escrow.escrows(escrowId);
      expect(details.state).to.equal(6); // EscrowState.RELEASED
    });
  });

  describe("Disputes & Resolution", function () {
    let escrowId = 0;

    beforeEach(async function () {
      const milestoneAmounts = [ethers.parseEther("100"), ethers.parseEther("200")];
      await escrow.createEscrow(buyer.address, seller.address, await token.getAddress(), milestoneAmounts);
      await token.connect(buyer).approve(await escrow.getAddress(), ethers.parseEther("300"));
      await escrow.connect(buyer).fundEscrow(escrowId);
    });

    it("should allow buyer or seller to raise a dispute", async function () {
      const evidence = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
      await expect(escrow.connect(buyer).disputeEscrow(escrowId, evidence))
        .to.emit(escrow, "EscrowDisputed")
        .withArgs(escrowId, evidence);

      const details = await escrow.escrows(escrowId);
      expect(details.state).to.equal(4); // EscrowState.DISPUTED
    });

    it("should allow arbitrator to resolve dispute", async function () {
      const evidence = ethers.keccak256(ethers.toUtf8Bytes("evidence"));
      await escrow.connect(buyer).disputeEscrow(escrowId, evidence);

      const buyerInitialBalance = await token.balanceOf(buyer.address);
      const sellerInitialBalance = await token.balanceOf(seller.address);

      await expect(escrow.connect(arbitrator).resolveDispute(escrowId, ethers.parseEther("100"), ethers.parseEther("200")))
        .to.emit(escrow, "DisputeResolved")
        .withArgs(escrowId, ethers.parseEther("100"), ethers.parseEther("200"));

      const buyerFinalBalance = await token.balanceOf(buyer.address);
      const sellerFinalBalance = await token.balanceOf(seller.address);

      expect(buyerFinalBalance - buyerInitialBalance).to.equal(ethers.parseEther("100"));
      expect(sellerFinalBalance - sellerInitialBalance).to.equal(ethers.parseEther("200"));

      const details = await escrow.escrows(escrowId);
      expect(details.state).to.equal(5); // EscrowState.RESOLVED
    });
  });

  describe("Pause & Admin Limits", function () {
    it("should allow admin to pause and block critical functions", async function () {
      await escrow.connect(admin).pause();

      const milestoneAmounts = [ethers.parseEther("100")];
      await expect(
        escrow.createEscrow(buyer.address, seller.address, await token.getAddress(), milestoneAmounts)
      ).to.be.revertedWith("Pausable: paused");
    });
  });
});
