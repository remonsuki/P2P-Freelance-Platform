// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @notice Testnet course escrow. Quotes bind the price, wallets, time and slot to this chain and contract.
contract SkillEscrow is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;
    enum State { None, Funded, Disputed, Released, Refunded }
    struct Quote {
        bytes32 paymentId;
        bytes32 slotKey;
        address student;
        address teacher;
        uint256 amount;
        uint64 startsAt;
        uint64 endsAt;
        uint64 deadline;
    }
    struct Payment {
        Quote quote;
        State state;
        uint64 fundedBlock;
        uint64 changedBlock;
    }
    bytes32 private constant QUOTE_TYPEHASH = keccak256("Quote(bytes32 paymentId,bytes32 slotKey,address student,address teacher,uint256 amount,uint64 startsAt,uint64 endsAt,uint64 deadline)");
    uint256 public constant CLAIM_DELAY = 7 days;
    IERC20 public immutable token;
    address public immutable quoteSigner;
    mapping(bytes32 => Payment) private payments;
    mapping(bytes32 => bytes32) public occupiedSlots;
    mapping(bytes32 => bytes32) private studentSlots;
    event PaymentStateChanged(bytes32 indexed paymentId, State state, address actor);

    constructor(address tokenAddress, address signerAddress) EIP712("YunBarterSkillEscrow", "1") {
        require(tokenAddress.code.length > 0 && signerAddress != address(0), "Invalid configuration");
        token = IERC20(tokenAddress);
        quoteSigner = signerAddress;
    }
    function version() external pure returns (uint256) { return 1; }
    function getPayment(bytes32 paymentId) external view returns (Payment memory) { return payments[paymentId]; }
    function studentSlot(Quote memory q) private pure returns (bytes32) {
        return keccak256(abi.encode(q.student, q.startsAt, q.endsAt));
    }
    function fund(Quote calldata q, bytes calldata signature) external nonReentrant {
        require(q.paymentId != bytes32(0) && q.slotKey != bytes32(0), "Invalid reference");
        require(msg.sender == q.student && q.teacher != address(0) && q.teacher != q.student, "Invalid participants");
        require(q.amount > 0 && q.startsAt > block.timestamp && q.endsAt > q.startsAt, "Invalid course");
        require(block.timestamp <= q.deadline && q.deadline < q.startsAt, "Quote expired");
        require(payments[q.paymentId].state == State.None, "Already funded");
        require(occupiedSlots[q.slotKey] == bytes32(0) && studentSlots[studentSlot(q)] == bytes32(0), "Slot occupied");
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(QUOTE_TYPEHASH, q)));
        require(ECDSA.recover(digest, signature) == quoteSigner, "Invalid quote signature");
        payments[q.paymentId] = Payment(q, State.Funded, uint64(block.number), uint64(block.number));
        occupiedSlots[q.slotKey] = q.paymentId;
        studentSlots[studentSlot(q)] = q.paymentId;
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), q.amount);
        require(token.balanceOf(address(this)) - beforeBalance == q.amount, "Unsupported token");
        emit PaymentStateChanged(q.paymentId, State.Funded, msg.sender);
    }
    function cancel(bytes32 paymentId) external nonReentrant {
        Payment storage p = payments[paymentId];
        require(msg.sender == p.quote.student && p.state == State.Funded, "Cannot cancel");
        require(block.timestamp < p.quote.startsAt, "Course started");
        settle(paymentId, p, State.Refunded);
    }
    function complete(bytes32 paymentId) external nonReentrant {
        Payment storage p = payments[paymentId];
        require(msg.sender == p.quote.student && p.state == State.Funded, "Cannot complete");
        require(block.timestamp >= p.quote.endsAt, "Course not ended");
        settle(paymentId, p, State.Released);
    }
    function dispute(bytes32 paymentId) external {
        Payment storage p = payments[paymentId];
        require(msg.sender == p.quote.student && p.state == State.Funded, "Cannot dispute");
        require(block.timestamp >= p.quote.startsAt && block.timestamp < p.quote.endsAt + CLAIM_DELAY, "Outside dispute period");
        p.state = State.Disputed;
        p.changedBlock = uint64(block.number);
        emit PaymentStateChanged(paymentId, State.Disputed, msg.sender);
    }
    function refund(bytes32 paymentId) external nonReentrant {
        Payment storage p = payments[paymentId];
        require(msg.sender == p.quote.teacher && p.state == State.Disputed, "Cannot refund");
        settle(paymentId, p, State.Refunded);
    }
    function claim(bytes32 paymentId) external nonReentrant {
        Payment storage p = payments[paymentId];
        require(msg.sender == p.quote.teacher && p.state == State.Funded, "Cannot claim");
        require(block.timestamp >= p.quote.endsAt + CLAIM_DELAY, "Claim delay");
        settle(paymentId, p, State.Released);
    }
    function settle(bytes32 paymentId, Payment storage p, State state) private {
        p.state = state;
        p.changedBlock = uint64(block.number);
        if (state == State.Refunded) {
            delete occupiedSlots[p.quote.slotKey];
            delete studentSlots[studentSlot(p.quote)];
        }
        emit PaymentStateChanged(paymentId, state, msg.sender);
        token.safeTransfer(state == State.Released ? p.quote.teacher : p.quote.student, p.quote.amount);
    }
}
