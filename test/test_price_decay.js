import BigNumber from 'bignumber.js';
import { sprintf } from 'sprintf-js';
import expectThrow from 'zeppelin-solidity/test/helpers/expectThrow';
import increaseTime from 'zeppelin-solidity/test/helpers/increaseTime';

import helpers from './lib/helpers.js';
import defaults from './lib/defaults.js';
import stages from './lib/stages.js';
import { intervalMultiplier, dailyPrices } from './lib/prices.js';

var DutchAuction = artifacts.require("./DutchAuction.sol");
var ShopToken = artifacts.require("./ShopToken.sol");

contract('PriceDecay', function (accounts) {
  let auctionContract;
  let tokenContract;
  const proxyAddress = accounts[0];  

  // Assuming 1 ETH = 1000 USD
  const conversionRate = 0.001;

  // Reset contract state before each test case
  beforeEach(async function () {
    const startPrice = new BigNumber(19.99);
    const startPriceWei = startPrice.times(conversionRate).times(defaults.multiplier);

    // Deploy contracts
    auctionContract = await DutchAuction.new(
      startPriceWei.toString(), 
      defaults.pricePrecision, 
      defaults.minimumBid, 
      defaults.claimPeriod, 
      proxyAddress
    );

    tokenContract = await ShopToken.new(
      auctionContract.address, 
      defaults.initialSupply, 
      defaults.auctionSupply
    );
    
    await auctionContract.startAuction(
      tokenContract.address, 
      defaults.offering, 
      defaults.bonus
    );
  });

  async function assertIntervalsPassed(value) {
    let days = await auctionContract.getIntervals();
    assert.equal(days.toNumber(), value * intervalMultiplier, "Number of passed intervals should be correct");
  }

  // Not actually USD
  async function assertPriceUSD(thePrice) {
    let price = await auctionContract.getPrice();
    let priceUSD = web3.fromWei(price, "ether").div(conversionRate).toFormat(2, BigNumber.ROUND_HALF_UP);
    assert.equal(priceUSD, thePrice, "Current day price should be correct");
  }

  for (let i = 0; i < 30; i++) {
    const testName = sprintf("Day %s price should be $%s", i+1, dailyPrices[i]);
    it(testName, async function () {
      await increaseTime(helpers.byDays(i));
      await assertIntervalsPassed(i);
      await assertPriceUSD(dailyPrices[i]);
    });
  }

  it("Fallback price should be $0.01", async function () {
    const lastPrice = dailyPrices[dailyPrices.length - 1];
    await increaseTime(helpers.byDays(30));
    await assertPriceUSD(lastPrice);
  });  
});
