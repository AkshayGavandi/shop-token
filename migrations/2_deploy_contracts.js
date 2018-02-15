const BigNumber = require('bignumber.js');

var DutchAuction = artifacts.require("DutchAuction");
var ShopToken = artifacts.require("ShopToken");

module.exports = function (deployer, network, accounts) {
  // Mint 1B tokens
  const multiplier = new BigNumber(10).pow(18).toString();
  const initialSupply = new BigNumber(10).pow(9).multipliedBy(multiplier).toString();

  // Prepare 100K tokens for sale + 5% oversubscription bonus
  const offering = new BigNumber(100000).multipliedBy(multiplier);
  const bonus = new BigNumber(5000).multipliedBy(multiplier);
  const auctionSupply = offering.plus(bonus).toString();

  // USDETH Rate - 0.0011, 16 Feb 2018
  // Start price - $19.99
  // Minimum bid amount - 100K wei
  const minimumBid = 100000;
  const pricePrecision = 100000;
  const priceStart = new BigNumber(19.99).multipliedBy(0.0011).multipliedBy(pricePrecision).toString();

  // Tokens can be claimed 7 days after auction ends
  const claimPeriod = 86400 * 7;

  // Deployer can also place Bitcoin bids
  const proxyAddress = accounts[0];

  // Deploy
  deployer.deploy(DutchAuction, priceStart, pricePrecision, minimumBid, claimPeriod, proxyAddress).then(function () {
    return deployer.deploy(ShopToken, DutchAuction.address, initialSupply, auctionSupply);
  });
};
