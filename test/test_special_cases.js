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

contract('SpecialCases', function (accounts) {
  let auctionContract;
  let tokenContract;

  const startPrice = new BigNumber(20);
  const minimumBid = 1;

  // 0 - owner, 1 - bidder, above 2 - wallet
  const proxyAddress = accounts[0];
  let walletIndex = 1;
  const initialBalance = web3.eth.getBalance(accounts[walletIndex]).toNumber();

  // Reset contract state before each test case
  beforeEach(async function () {
    walletIndex++;

    auctionContract = await DutchAuction.new(
      startPrice.toString(),
      defaults.pricePrecision,
      minimumBid,
      defaults.claimPeriod,
      accounts[walletIndex],
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

  async function assertTokenBalance(id, amount) {
    const tokenBalance = await tokenContract.balanceOf(accounts[id]);
    assert.equal(tokenBalance.toNumber(), amount, "Token balance should be correct");
  }

  /*
   * Results:
   * - Bidder A will receive 2000 token units
   * - All other tokens will be returned to the wallet
   */
  it("Should verify token undersubscription", async function () {
    const firstBid = 40000;
    const tokensReceived = 2000;

    // Place 1st bid and immediately end auction
    await auctionContract.sendTransaction({ from: accounts[1], value: firstBid });
    await auctionContract.endAuction();
    await increaseTime(helpers.byDays(8));

    // Transfer tokens back
    await auctionContract.claimTokens({ from: accounts[1] });
    await auctionContract.transferBack();

    // Verify token balances
    await assertTokenBalance(1, tokensReceived);
    await assertTokenBalance(walletIndex, defaults.auctionSupply - tokensReceived);
  });
});
