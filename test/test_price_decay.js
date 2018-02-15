import BigNumber from 'bignumber.js';
import { sprintf } from 'sprintf-js';
import expectThrow from 'zeppelin-solidity/test/helpers/expectThrow';
import increaseTime from 'zeppelin-solidity/test/helpers/increaseTime';

import helpers from './lib/helpers.js';
import defaults from './lib/defaults.js';
import stages from './lib/stages.js';

var DutchAuction = artifacts.require("./DutchAuction.sol");
var ShopToken = artifacts.require("./ShopToken.sol");

contract('PriceDecay', function (accounts) {
  let auctionContract;
  let tokenContract;

  // Assuming 1 ETH = 1000 USD
  const conversionRate = 0.001;

  // For `PriceDecay30`
  // let inverval_multiplier = 1;  
  // const dailyPrices = [
  //   19.99, 15.38, 11.84, 9.11, 7.01,
  //   5.39, 4.15, 3.19, 2.46, 1.89,
  //   1.45, 1.12, 0.86, 0.66, 0.51,
  //   0.39, 0.30, 0.23, 0.18, 0.14,
  //   0.11, 0.08, 0.06, 0.05, 0.04,
  //   0.03, 0.02, 0.02, 0.01, 0.01
  // ];

  // For `PriceDecay150`
  const inverval_multiplier = 5;
  const dailyPrices = [
    19.99, 15.49, 12.00, 9.30, 7.21,
    5.58, 4.33, 3.35, 2.60, 2.01,
    1.56, 1.21, 0.94, 0.73, 0.56,
    0.44, 0.34, 0.26, 0.20, 0.16,
    0.12, 0.09, 0.07, 0.06, 0.04,
    0.03, 0.03, 0.02, 0.02, 0.01
  ];

  // Reset contract state before each test case
  beforeEach(async function () {
    const startPrice = new BigNumber(19.99);
    const startPriceWei = startPrice.times(conversionRate).times(defaults.multiplier);
    const proxyAddress = accounts[0];

    // Deploy contracts
    auctionContract = await DutchAuction.new(startPriceWei.toNumber(), defaults.claimPeriod, proxyAddress);
    tokenContract = await ShopToken.new(auctionContract.address, defaults.initialSupply, defaults.auctionSupply);
    await auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus);
  });

  async function assertIntervalsPassed(value) {
    let days = await auctionContract.getIntervals();
    assert.equal(days.toNumber(), value * inverval_multiplier, "Number of passed intervals should be correct");
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

  it("Shouldn't accept bids after 30 days", async function () {
    await increaseTime(helpers.byDays(30));
    await expectThrow(auctionContract.sendTransaction({ value: 100000 }));
  });  
});
