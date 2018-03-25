pragma solidity ^0.4.17;

import "./PriceDecay150.sol";
import "./ShopToken.sol";

contract DutchAuction is PriceDecay150 {
    // Auction Bid
    struct Bid {
        uint256 price;
        uint256 transfer;
        bool placed;
        bool claimed;
        bool isBitcoin;
    }

    // Auction Stages
    enum Stages {
        AuctionDeployed,
        AuctionStarted,
        AuctionEnded,
        TokensDistributed
    }

    // Auction Ending Reasons
    enum Endings {
        Manual,
        TimeLimit,
        SoldOut,
        SoldOutBonus
    }

    // Auction Events
    event AuctionDeployed(uint256 indexed priceStart);
    event AuctionStarted(uint256 _startTime);
    event AuctionEnded(uint256 priceFinal, uint256 _endTime, Endings ending);
    event BidAccepted(address indexed _address, uint256 price, uint256 transfer, bool isBitcoin);
    event BidPartiallyRefunded(address indexed _address, uint256 transfer);
    event FundsTransfered(address indexed _bidder, address indexed _wallet, uint256 amount);
    event TokensClaimed(address indexed _address, uint256 amount);
    event TokensDistributed();

    // Token contract reference
    ShopToken public token;

    // Current stage
    Stages public current_stage;

    // `address` ⇒ `Bid` mapping
    mapping (address => Bid) public bids;

    // Auction owner address
    address public owner_address;

    // Wallet address
    address public wallet_address;

    // Bitcoin bidder proxy address
    address public proxy_address;

    // Starting price in wei
    uint256 public price_start;

    // Final price in wei
    uint256 public price_final;

    // Number of received wei
    uint256 public received_wei = 0;

    // Number of claimed wei
    uint256 public claimed_wei = 0;

    // Total number of token units for auction
    uint256 public initial_offering;

    // Oversubscription bonus
    uint256 public last_bonus;

    // Auction start time
    uint256 public start_time;

    // Auction end time
    uint256 public end_time;

    // Time after the end of the auction, before anyone can claim tokens
    uint256 public claim_period;

    // Minimum bid amount
    uint256 public minimum_bid;

    // Price precision
    uint256 public price_precision;

    // Whitelisting enabled
    bool public whitelisting = false;

    // Whitelist for Ethereum addresses
    mapping (address => bool) public whitelist;

    // Stage modifier
    modifier atStage(Stages _stage) {
        require(current_stage == _stage);
        _;
    }

    // Owner modifier
    modifier isOwner() {
        require(msg.sender == owner_address);
        _;
    }

    // Proxy modifier
    modifier isProxy() {
        require(msg.sender == proxy_address);
        _;
    }

    // Constructor
    function DutchAuction(
        uint256 _priceStart,
        uint256 _pricePrecision,
        uint256 _minimumBid,
        uint256 _claimPeriod,
        address _walletAddress,
        address _proxyAddress
    )
        public
    {
        // Set auction owner address
        owner_address = msg.sender;
        wallet_address = _walletAddress;
        proxy_address = _proxyAddress;

        // Set auction parameters
        price_start = _priceStart;
        price_final = _priceStart;
        price_precision = _pricePrecision;
        minimum_bid = _minimumBid;
        claim_period = _claimPeriod;

        // Update auction stage and fire event
        current_stage = Stages.AuctionDeployed;
        AuctionDeployed(_priceStart);
    }

    // Default fallback function
    function () public payable atStage(Stages.AuctionStarted) {
        placeBidGeneric(msg.sender, msg.value, false);
    }

    // Setup auction
    function startAuction(
        address _tokenAddress,
        uint256 offering,
        uint256 bonus
    )
        external
        isOwner
        atStage(Stages.AuctionDeployed)
    {
        // Initialize external contract type
        token = ShopToken(_tokenAddress);
        uint256 balance = token.balanceOf(address(this));

        // Verify & Initialize starting parameters
        require(balance == offering + bonus);
        initial_offering = offering;
        last_bonus = bonus;

        // Update auction stage and fire event
        start_time = block.timestamp;
        current_stage = Stages.AuctionStarted;
        AuctionStarted(start_time);
    }

    // End auction
    function endAuction() external isOwner atStage(Stages.AuctionStarted) {
        endImmediately(price_final, Endings.Manual);
    }

    // Add addresses to whitelist
    function whitelistAdd(address[] input) external isProxy {
        for (uint32 i = 0; i < input.length; i++) {
            whitelist[input[i]] = true;
        }
    }

    // Remove addresses from whitelist
    function whitelistRemove(address[] input) external isProxy {
        for (uint32 i = 0; i < input.length; i++) {
            whitelist[input[i]] = false;
        }
    }

    // Place Bitcoin bid
    function placeBitcoinBid(address beneficiary, uint256 bidValue) external isProxy atStage(Stages.AuctionStarted) {
        return placeBidGeneric(beneficiary, bidValue, true);
    }

    // Generic bid validation from ETH or BTC origin
    function placeBidGeneric(
        address sender,
        uint256 bidValue,
        bool isBitcoin
    )
        private
        atStage(Stages.AuctionStarted)
    {
        // Whitelisting check
        if (whitelisting) {
            require(whitelist[sender]);
        }

        // Input validation
        uint256 currentInterval = (block.timestamp - start_time) / interval_divider;
        require(!bids[sender].placed && currentInterval < intervals && bidValue >= minimum_bid);

        // Check if value of received bids equals or exceeds the implied value of all tokens
        uint256 currentPrice = calcPrice(price_start, currentInterval);
        uint256 acceptableWei = (currentPrice * initial_offering) - received_wei;
        if (bidValue > acceptableWei) {
            // Place last bid with oversubscription bonus
            uint256 acceptedWei = currentPrice * last_bonus + acceptableWei;
            if (bidValue <= acceptedWei) {
                // Place bid with all available value
                placeBidInner(sender, currentPrice, bidValue, isBitcoin);
            } else {
                // Place bid with available value
                placeBidInner(sender, currentPrice, acceptedWei, isBitcoin);

                // Refund remaining value
                uint256 returnedWei = bidValue - acceptedWei;
                sender.transfer(returnedWei);
                BidPartiallyRefunded(sender, returnedWei);
            }

            // End auction
            endImmediately(currentPrice, Endings.SoldOutBonus);
        } else if (bidValue == acceptableWei) {
            // Place last bid && end auction
            placeBidInner(sender, currentPrice, acceptableWei, isBitcoin);
            endImmediately(currentPrice, Endings.SoldOut);
        } else {
            // Place bid and update last price
            placeBidInner(sender, currentPrice, bidValue, isBitcoin);
        }
    }

    // Inner function for placing bid
    function placeBidInner(
        address sender,
        uint256 price,
        uint256 value,
        bool isBitcoin
    )
        private
        atStage(Stages.AuctionStarted)
    {
        // Create bid
        Bid memory bid = Bid({
            price: price,
            transfer: value,
            placed: true,
            claimed: false,
            isBitcoin: isBitcoin
        });

        // Save and fire event
        bids[sender] = bid;
        BidAccepted(sender, price, value, isBitcoin);

        // Update received wei and last price
        received_wei = received_wei + value;
        if (price < price_final) {
            price_final = price;
        }

        // Send bid amount to owner
        if (!isBitcoin) {
            wallet_address.transfer(value);
            FundsTransfered(sender, wallet_address, value);
        }
    }

    // Inner function for ending auction
    function endImmediately(uint256 atPrice, Endings ending) private atStage(Stages.AuctionStarted) {
        end_time = block.timestamp;
        price_final = atPrice;
        current_stage = Stages.AuctionEnded;
        AuctionEnded(price_final, end_time, ending);
    }

    // Claim tokens
    function claimTokens() external atStage(Stages.AuctionEnded) {
        // Input validation
        require(block.timestamp >= end_time + claim_period);
        require(bids[msg.sender].placed && !bids[msg.sender].claimed);

        // Calculate tokens to receive
        uint256 tokens = (bids[msg.sender].transfer / price_final) * price_precision;
        uint256 auctionTokensBalance = token.balanceOf(address(this));
        if (tokens > auctionTokensBalance) {
            // Unreachable code
            tokens = auctionTokensBalance;
        }

        // Transfer tokens and fire event
        token.transfer(msg.sender, tokens);
        TokensClaimed(msg.sender, tokens);

        // Update the total amount of funds for which tokens have been claimed
        claimed_wei = claimed_wei + bids[msg.sender].transfer;
        bids[msg.sender].claimed = true;

        // Set new state if all tokens distributed
        if (claimed_wei >= received_wei) {
            current_stage = Stages.TokensDistributed;
            TokensDistributed();
        }
    }

    // Transfer unused tokens back to the wallet
    function transferBack() external isOwner atStage(Stages.TokensDistributed) {
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0);
        token.transfer(wallet_address, balance);
    }

    // Returns intervals passed
    // Used for unit tests
    function getIntervals() public atStage(Stages.AuctionStarted) view returns (uint256) {
        return (block.timestamp - start_time) / interval_divider;
    }

    // Returns current price
    // Used for unit tests
    function getPrice() public atStage(Stages.AuctionStarted) view returns (uint256) {
        uint256 currentInterval = getIntervals();
        if (currentInterval > intervals - 1) {
            currentInterval = intervals - 1;
        }

        return calcPrice(price_start, currentInterval);
    }
}
