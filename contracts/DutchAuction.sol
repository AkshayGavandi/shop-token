pragma solidity ^0.4.17;

import "./ShopToken.sol";

contract DutchAuction {
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
        AuctionSetup,
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
    event AuctionSetup();
    event AuctionStarted();
    event AuctionEnded(uint256 priceFinal, Endings ending);    
    event BidAccepted(address indexed _address, uint256 price, uint256 transfer, bool isBitcoin);
    event BidPartiallyRefunded(address indexed _address, uint256 transfer);
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

    // Bitcoin bidder proxy address
    address public proxy_address;

    // Starting price in wei
    uint256 public price_start;

    // Final price in wei
    uint256 public price_final;

    // Token unit multiplier
    uint256 public token_multiplier = 10 ** 18;

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

    // Wait 7 days after the end of the auction, before anyone can claim tokens
    uint256 constant public TOKEN_CLAIM_DELAY_PERIOD = 7 days;    

    // Auction duration, in days
    uint256 public duration = 30;

    // Precision for price calculation
    uint256 public precision = 10 ** 13;

    // Price decay rates per day
    uint[30] public rates = [
        precision,
        7694472807310,
        5920491178244,
        4555505837691,
        3505221579166,
        2697083212449,
        2075263343724,
        1596805736629,
        1228657831905,
        945387427708,
        727425785487,
        559715792577,
        430671794580,
        331379241228,
        254978856053,
        196192787434,
        150960006790,
        116155766724,
        89375738847,
        68769919219,
        52914827339,
        40715170006,
        31328176846,
        24105380484,
        18547819465,
        14271569251,
        10981220152,
        8449469985,
        6501421703,
        5002501251
    ];    

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
    function DutchAuction(uint256 _priceStart, address _proxyAddress) public {
        // Set auction owner address
        owner_address = msg.sender;
        proxy_address = _proxyAddress;

        // Set auction parameters
        price_start = _priceStart;
        price_final = _priceStart;

        // Update auction stage and fire event
        current_stage = Stages.AuctionDeployed;
        AuctionDeployed(_priceStart);
    }

    // Default fallback function
    function () public payable atStage(Stages.AuctionStarted) {
        placeBid();
    }

    // Place Ethereum bid
    function placeBid() public payable atStage(Stages.AuctionStarted) returns (bool) {
        return placeBidGeneric(msg.sender, msg.value, false);
    }

    // Place Bitcoin bid
    function placeBitcoinBid(address beneficiary, uint256 bidValue) external isProxy atStage(Stages.AuctionStarted) returns (bool) {
        return placeBidGeneric(beneficiary, bidValue, true);
    }   

    // Setup auction
    function setupAuction(address _tokenAddress, uint256 offering, uint256 bonus) external isOwner atStage(Stages.AuctionDeployed) {
        // Initialize external contract type      
        token = ShopToken(_tokenAddress);
        uint256 balance = token.balanceOf(address(this));

        // Verify & Initialize starting parameters
        require(balance == offering + bonus);        
        initial_offering = offering;
        last_bonus = bonus;

        // Update auction stage and fire event
        current_stage = Stages.AuctionSetup;
        AuctionSetup();
    }

    // Starts auction
    function startAuction() external isOwner atStage(Stages.AuctionSetup) {
        // Update auction stage and fire event
        current_stage = Stages.AuctionStarted;
        start_time = block.timestamp;
        AuctionStarted();
    }

    // End auction
    function endAuction() external isOwner atStage(Stages.AuctionStarted) {
        // Update auction states and fire event
        uint256 price = getPrice();
        endImmediately(price, Endings.Manual);
    }

    // Claim tokens
    function claimTokens() external atStage(Stages.AuctionEnded) {
        // Input validation
        require(bids[msg.sender].placed);
        require(!bids[msg.sender].claimed);   
        require(block.timestamp > end_time + TOKEN_CLAIM_DELAY_PERIOD);

        // Calculate tokens to receive
        uint256 tokens = bids[msg.sender].transfer / price_final;
        uint256 auctionTokensBalance = token.balanceOf(address(this));
        if (tokens > auctionTokensBalance) {
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

    // View tokens to be claimed during claim period
    function viewTokensToClaim() external atStage(Stages.AuctionEnded) view returns (uint256) {
        // Throw if no bid exists
        require(bids[msg.sender].placed);
        require(!bids[msg.sender].claimed);

        uint256 tokenCount = bids[msg.sender].transfer / price_final;
        return tokenCount;
    }

    // Returns days passed
    function getDays() public atStage(Stages.AuctionStarted) view returns (uint256) {
        return (block.timestamp - start_time) / 86400;
    }

    // Returns current price
    function getPrice() public atStage(Stages.AuctionStarted) view returns (uint) {
        uint256 _day = getDays();
        if (_day > 29) {
            _day = 29;
        }

        return (price_start * rates[_day]) / precision;
    }

    // Generic bid validation from ETH or BTC origin
    function placeBidGeneric(address sender, uint256 bidValue, bool isBitcoin) private atStage(Stages.AuctionStarted) returns (bool) {
        // Allow only a single bid per address
        require(!bids[sender].placed);

        // Automatically end auction if date limit exceeded
        uint256 currentDay = (block.timestamp - start_time) / 86400;
        if (currentDay > duration) {       
            endImmediately(price_final, Endings.TimeLimit);
            return false;
        }

        // Check if value of received bids equals or exceeds the implied value of all tokens
        uint256 currentPrice = price_start * rates[currentDay] / precision;
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
                BidPartiallyRefunded(sender, returnedWei);
                sender.transfer(returnedWei);
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

            if (currentPrice < price_final) {
                price_final = currentPrice;
            }            
        }

        return true;        
    }

    // Inner function for placing bid
    function placeBidInner(address sender, uint256 price, uint256 value, bool isBitcoin) private atStage(Stages.AuctionStarted) {
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

        // Update received wei value
        received_wei = received_wei + value;

        // Send bid amount to owner
        if (!isBitcoin) {
            owner_address.transfer(value);
        }
    }

    // Inner function for ending auction
    function endImmediately(uint256 atPrice, Endings ending) private atStage(Stages.AuctionStarted) {
        end_time = block.timestamp;
        price_final = atPrice;
        current_stage = Stages.AuctionEnded;
        AuctionEnded(price_final, ending);        
    }
}