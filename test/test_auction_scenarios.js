import BigNumber from 'bignumber.js';
import expectThrow from 'zeppelin-solidity/test/helpers/expectThrow';
import increaseTime from 'zeppelin-solidity/test/helpers/increaseTime';

import helpers from './lib/helpers.js';
import defaults from './lib/defaults.js';
import endings from './lib/endings.js';
import events from './lib/events.js';
import stages from './lib/stages.js';

var DutchAuction = artifacts.require("./DutchAuction.sol");
var ShopToken = artifacts.require("./ShopToken.sol");

contract('AuctionScenarios', function (accounts) {
  let auctionContract;
  let tokenContract;

  // 0 - owner, [1; 3] - bidders, 4 - proxy
  const proxyAddress = accounts[4];

  // Reset contract state before each test case
  beforeEach(async function () {
    const startPrice = new BigNumber(20);

    // Deploy contracts
    auctionContract = await DutchAuction.new(startPrice.toNumber(), defaults.claimPeriod, proxyAddress);
    tokenContract = await ShopToken.new(auctionContract.address, defaults.initialSupply, defaults.auctionSupply);

    // Setup and start auction
    await auctionContract.setupAuction(tokenContract.address, defaults.offering, defaults.bonus);
    await auctionContract.startAuction();
  });

  async function assertReceivedWei(value) {
    const result = await auctionContract.received_wei.call();
    assert.equal(result.toNumber(), value, "Received wei should be correct");
  }

  async function assertAcceptedBid(id, amount) {
    const result = await auctionContract.sendTransaction({ from: accounts[id], value: amount });
    assert.equal(result.logs[0].event, events.BID_ACCEPTED, "Should fire `BidAccepted` event");
  }

  async function assertAcceptedBitcoinBid(id, amount) {
    const result = await auctionContract.placeBitcoinBid(accounts[id], amount, { from: proxyAddress });
    assert.equal(result.logs[0].event, events.BID_ACCEPTED, "Should fire `BidAccepted` event");
  }

  async function assertPartiallyRefundedBid(id, amount, accepted, ending) {
    // Place bid
    const result = await auctionContract.sendTransaction({ from: accounts[id], value: amount });
    assert.equal(result.logs[0].event, events.BID_ACCEPTED, "Should fire `BidAccepted` event");
    assert.equal(result.logs[0].args.transfer.toNumber(), accepted, "Accepted wei value should be correct");

    // Ensure proper amount is refunded
    const bidAmount = new BigNumber(amount);
    const refunded = bidAmount.minus(accepted).toNumber();
    assert.equal(result.logs[1].event, events.BID_PARTIALLY_REFUNDED, "Should fire `BidPartiallyRefunded` event");
    assert.equal(result.logs[1].args.transfer.toNumber(), refunded, "Refund transfer value should be correct");    

    // Ensure auction is ended with correct reasons
    assert.equal(result.logs[2].event, events.AUCTION_ENDED, "Should fire `AuctionEnded` event");
    assert.equal(result.logs[2].args.ending, ending, "Should end with correct ending reason");
  }

  async function assertBidResult(id, amount) {
    const result = await auctionContract.claimTokens({ from: accounts[id] });
    assert.equal(result.logs[0].event, events.TOKENS_CLAIMED, "Should fire `TokensClaimed` event");
    assert.equal(result.logs[0].args.amount.toNumber(), amount, "Number of claimed tokens should be correct"); 
  
    const tokenBalance = await tokenContract.balanceOf(accounts[id]);
    assert.equal(tokenBalance, amount, "Token balance should be correct");
  }

  /*
   * === Auction Scenario I ===
   * 
   * Description:
   * - Initial offering       ⇒ sold out
   * - Oversubscription bonus ⇒ untouched
   *
   * Bids:
   * | Day | Bidder | Price  | Units | Bid Amount  |
   * | === | ====== | ====== | ===== | =========== |
   * | 1   | A      | 20 wei | 2000  | 40000 wei   |
   * | 2   | B      | 15 wei | 2000  | 30000 wei   |
   * | 2   | C      | 15 wei | 5333  | 80000 wei   |
   * 
   * Results:
   * - Bidder A will receive 2666 token units
   * - Bidder B will receive 2000 token units
   * - Bidder C will receive 5333 token units
   */
  it("Should verify Auction Scenario I", async function () {
    // Bidder simulation parameters
    const bids = { first: 40000, second: 30000, third: 80000 };
    const transfers = { first: 40000, second: 30000, third: 87500 };
    const received = { after1: 40000, after2: 70000, after3: 150000 };
    const results = { bidderA: 2666, bidderB: 2000, bidderC: 5333 };

    // Place 1st bid
    await assertAcceptedBid(1, bids.first);
    await assertReceivedWei(received.after1);

    // Fast-forward 1st day to decrease price
    await increaseTime(helpers.byDays(1));

    // Place 2nd bid
    await assertAcceptedBid(2, bids.second);
    await assertReceivedWei(received.after2);

    // Place 3rd bid
    await assertAcceptedBid(3, bids.third);
    await assertReceivedWei(received.after3);

    // Fast-forward 7 days to claim tokens
    await increaseTime(helpers.byDays(8));

    // Verify token balances
    await assertBidResult(1, results.bidderA);
    await assertBidResult(2, results.bidderB);
    await assertBidResult(3, results.bidderC);
  });

  /*
   * === Auction Scenario II ===
   * 
   * Description:
   * - Initial offering       ⇒ sold out
   * - Oversubscription bonus ⇒ partially sold
   *
   * Bids:
   * | Day | Bidder | Price  | Units | Bid Amount  |
   * | === | ====== | ====== | ===== | =========== |
   * | 1   | A      | 20 wei | 2000  | 40000 wei   |
   * | 2   | B      | 15 wei | 2000  | 30000 wei   |
   * | 2   | C      | 15 wei | 5666  | 85000 wei   |
   *
   * Results:
   * - Bidder A will receive 2666 token units
   * - Bidder B will receive 2000 token units
   * - Bidder C will receive 5666 token units
   */
  it("Should verify Auction Scenario II", async function () {
    // Bidder simulation parameters
    const bids = { first: 40000, second: 30000, third: 85000 };
    const transfers = { first: 40000, second: 30000, third: 87500 };
    const received = { after1: 40000, after2: 70000, after3: 155000 };
    const results = { bidderA: 2666, bidderB: 2000, bidderC: 5666 };

    // Place 1st bid
    await assertAcceptedBid(1, bids.first);
    await assertReceivedWei(received.after1);

    // Fast-forward 1st day to decrease price
    await increaseTime(helpers.byDays(1));

    // Place 2nd bid
    await assertAcceptedBid(2, bids.second);
    await assertReceivedWei(received.after2);

    // Place 3rd bid
    await assertAcceptedBid(3, bids.third);
    await assertReceivedWei(received.after3);

    // Fast-forward 7 days to claim tokens
    await increaseTime(helpers.byDays(8));

    // Verify token balances
    await assertBidResult(1, results.bidderA);
    await assertBidResult(2, results.bidderB);
    await assertBidResult(3, results.bidderC);
  });

  /*
   * === Auction Scenario III ===
   * 
   * Description:
   * - Initial offering       ⇒ sold out
   * - Oversubscription bonus ⇒ sold out
   *
   * Bids:
   * | Day | Bidder | Price  | Units | Bid Amount  |
   * | === | ====== | ====== | ===== | =========== |
   * | 1   | A      | 20 wei | 2000  | 40000 wei   |
   * | 2   | B      | 15 wei | 2000  | 30000 wei   |
   * | 2   | C      | 15 wei | 5833  | 87500 wei   |
   *
   * Results:
   * - Bidder A will receive 2666 token units
   * - Bidder B will receive 2000 token units
   * - Bidder C will receive 5833 token units
   */
  it("Should verify Auction Scenario III", async function () {
    // Bidder simulation parameters
    const bids = { first: 40000, second: 30000, third: 87500 };
    const transfers = { first: 40000, second: 30000, third: 87500 };
    const received = { after1: 40000, after2: 70000, after3: 157500 };
    const results = { bidderA: 2666, bidderB: 2000, bidderC: 5833 };

    // Place 1st bid
    await assertAcceptedBid(1, bids.first);
    await assertReceivedWei(received.after1);

    // Fast-forward 1st day to decrease price
    await increaseTime(helpers.byDays(1));

    // Place 2nd bid
    await assertAcceptedBid(2, bids.second);
    await assertReceivedWei(received.after2);

    // Place 3rd bid
    await assertAcceptedBid(3, bids.third);
    await assertReceivedWei(received.after3);

    // Fast-forward 7 days to claim tokens
    await increaseTime(helpers.byDays(8));

    // Verify token balances
    await assertBidResult(1, results.bidderA);
    await assertBidResult(2, results.bidderB);
    await assertBidResult(3, results.bidderC);
  });

  /*
   * === Auction Scenario IV ===
   * 
   * Description:
   * - Initial offering       ⇒ sold out
   * - Oversubscription bonus ⇒ sold out
   * - Last bidder            ⇒ partially refunded
   *
   * Bids:
   * | Day | Bidder | Price  | Units | Bid Amount  | Accepted  | Refunded |
   * | === | ====== | ====== | ===== | =========== | ========= | ======== |
   * | 1   | A      | 20 wei | 2000  | 40000 wei   | All       | None     |
   * | 2   | B      | 15 wei | 2000  | 30000 wei   | All       | None     |
   * | 2   | C      | 15 wei | 6000  | 90000 wei   | 87500 wei | 2500 wei |
   *
   * Results:
   * - Bidder A will receive 2666 token units
   * - Bidder B will receive 2000 token units
   * - Bidder C will receive 5833 token units
   */
  it("Should verify Auction Scenario IV", async function () {
    // Bidder simulation parameters
    const bids = { first: 40000, second: 30000, third: 90000 };
    const transfers = { first: 40000, second: 30000, third: 87500 };
    const received = { after1: 40000, after2: 70000, after3: 157500 };
    const results = { bidderA: 2666, bidderB: 2000, bidderC: 5833 };

    // Place 1st bid
    await assertAcceptedBid(1, bids.first);
    await assertReceivedWei(received.after1);

    // Fast-forward 1st day to decrease price
    await increaseTime(helpers.byDays(1));

    // Place 2nd bid
    await assertAcceptedBid(2, bids.second);
    await assertReceivedWei(received.after2);

    // Place 3rd bid
    await assertPartiallyRefundedBid(3, bids.third, transfers.third, endings.SoldOutBonus);
    await assertReceivedWei(received.after3);

    // Fast-forward 7 days to claim tokens
    await increaseTime(helpers.byDays(8));

    // Verify token balances
    await assertBidResult(1, results.bidderA);
    await assertBidResult(2, results.bidderB);
    await assertBidResult(3, results.bidderC);
  });

  /*
   * === Auction Scenario V ===
   * 
   * Same as Scenario I but bids are placed by proxy from Bitcoin funding
   */
  it("Should verify Auction Scenario V", async function () {
    // Bidder simulation parameters
    const bids = { first: 40000, second: 30000, third: 80000 };
    const transfers = { first: 40000, second: 30000, third: 87500 };
    const received = { after1: 40000, after2: 70000, after3: 150000 };
    const results = { bidderA: 2666, bidderB: 2000, bidderC: 5333 };

    // Place 1st bid
    await assertAcceptedBitcoinBid(1, bids.first);
    await assertReceivedWei(received.after1);

    // Fast-forward 1st day to decrease price
    await increaseTime(helpers.byDays(1));

    // Place 2nd bid
    await assertAcceptedBitcoinBid(2, bids.second);
    await assertReceivedWei(received.after2);

    // Place 3rd bid
    await assertAcceptedBitcoinBid(3, bids.third);
    await assertReceivedWei(received.after3);

    // Fast-forward 7 days to claim tokens
    await increaseTime(helpers.byDays(8));

    // Verify token balances
    await assertBidResult(1, results.bidderA);
    await assertBidResult(2, results.bidderB);
    await assertBidResult(3, results.bidderC);
  });  
});
