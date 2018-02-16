import expectThrow from 'zeppelin-solidity/test/helpers/expectThrow';

import defaults from './lib/defaults.js'
import events from './lib/events.js';
import stages from './lib/stages.js';

var DutchAuction = artifacts.require("./DutchAuction.sol");
var ShopToken = artifacts.require("./ShopToken.sol");

contract('StageTransition', function (accounts) {
  let auctionContract;
  let tokenContract;

  const walletAddress = accounts[1];
  const proxyAddress = accounts[2];

  // Reset contract state before each test case
  beforeEach(async function () {
    auctionContract = await DutchAuction.new(
      defaults.priceStart, 
      defaults.pricePrecision, 
      defaults.minimumBid, 
      defaults.claimPeriod, 
      walletAddress,
      proxyAddress
    );
    
    tokenContract = await ShopToken.new(
      auctionContract.address, 
      defaults.initialSupply, 
      defaults.auctionSupply
    );
  });

  async function assertCurrentStage(stage) {
    const current_stage = await auctionContract.current_stage.call();
    assert.equal(current_stage, stage, "Current stage should be correct");
  }

  it("Should verify `AuctionDeployed` stage", async function () {
    await assertCurrentStage(stages.AuctionDeployed)

    // Can't jump over `AuctionStarted` stage
    await expectThrow(auctionContract.endAuction());
  });

  it("Should verify `AuctionStarted` stage", async function () {
    // Perform stage transition, verify fired event and current stage
    const result = await auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus);
    assert.equal(result.logs[0].event, events.AUCTION_STARTED, "Should fire `AuctionStarted` event");
    await assertCurrentStage(stages.AuctionStarted);
  });

  it("Should verify `AuctionEnded` stage", async function () {
    // Initial contract setup
    await auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus);
    const result = await auctionContract.endAuction();
    
    // Check fired event & verify current stage
    assert.equal(result.logs[0].event, events.AUCTION_ENDED, "Should fire `AuctionEnded` event");
    await assertCurrentStage(stages.AuctionEnded);

    // Can't move back
    await expectThrow(auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus));
  });
});
