import expectThrow from 'zeppelin-solidity/test/helpers/expectThrow';
import increaseTime from 'zeppelin-solidity/test/helpers/increaseTime';

import helpers from './lib/helpers.js'
import defaults from './lib/defaults.js'
import { dailyPrices } from './lib/prices.js';

var DutchAuction = artifacts.require("./DutchAuction.sol");
var ShopToken = artifacts.require("./ShopToken.sol");

contract('InputValidation', function (accounts) {
    let auctionContract;
    let tokenContract;
    const coinbase = accounts[0];
    const proxyAddress = accounts[1];
  
    // Reset contract state before each test case
    beforeEach(async function () {
      auctionContract = await DutchAuction.new(defaults.priceStart, defaults.claimPeriod, proxyAddress);
      tokenContract = await ShopToken.new(auctionContract.address, defaults.initialSupply, defaults.auctionSupply);
    });

    it("Should NOT allow stage transition by non-owner", async function () {
      // Throw on `AuctionDeployed` ⇒ `AuctionStarted`
      await expectThrow(auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus, { from: accounts[1] }));
  
      // Throw on `AuctionStarted` ⇒ `AuctionEnded`
      await auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus);
      await expectThrow(auctionContract.endAuction({ from: accounts[1] }));
    });

    it("Should NOT allow to start auction with invalid balance", async function () {
      await expectThrow(auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus + 1));
    });

    it("Should NOT allow to place multiple bids", async function () {
      await auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus);
      await auctionContract.sendTransaction({ value: 100000 });
      await expectThrow(auctionContract.sendTransaction({ value: 100000 }));
    });

    it("Should NOT accept bids after 30 days", async function () {
      await increaseTime(helpers.byDays(30));
      await expectThrow(auctionContract.sendTransaction({ value: 100000 }));
    });

    it("Should NOT allow to place Bitcoin bids from non-proxy address", async function () {
      await auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus);
      await auctionContract.sendTransaction({ value: 100000 });
      await expectThrow(auctionContract.placeBitcoinBid(proxyAddress, 100000, { from: coinbase }));
    });
    
    it("Should NOT allow to claim tokens before delay period", async function () {
      await auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus);
      await auctionContract.sendTransaction({ value: 100000 });
      await auctionContract.endAuction();
      await expectThrow(auctionContract.claimTokens());
    });

    it("Should NOT allow to claim tokens w/o bidding", async function () {
      await auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus);
      await auctionContract.endAuction();
      await increaseTime(helpers.byDays(7));
      await expectThrow(auctionContract.claimTokens());
    });     

    it("Should NOT allow to claim tokens twice", async function () {
      await auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus);
      await auctionContract.sendTransaction({ value: 100000 });
      await auctionContract.endAuction();
      await increaseTime(helpers.byDays(7));
      await auctionContract.claimTokens();
      await expectThrow(auctionContract.claimTokens());
    });
    
    it("Should verify initial supply values", async function () {
      const auctionBalance = await tokenContract.balanceOf(auctionContract.address);
      const tokenBalance = await tokenContract.balanceOf(accounts[0]);
  
      assert.equal(auctionBalance.toNumber(), defaults.auctionSupply, "Auction balance should be 10.5K");
      assert.equal(tokenBalance.toNumber(), defaults.tokenSupply, "Token balance should be 990M");
    });    
});