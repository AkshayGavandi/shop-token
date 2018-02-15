const BigNumber = require('bignumber.js');

var DutchAuction = artifacts.require("DutchAuction");
var ShopToken = artifacts.require("ShopToken");

module.exports = function (deployer, network, accounts) {
  // Mint 1B tokens
  const multiplier = new BigNumber(10).pow(18).toString();
  const initialSupply = new BigNumber(10).pow(9).multipliedBy(multiplier).toString();

  // Token constructor parameters
  const offering = 10000;
  const bonus = 500;
  const auctionSupply = offering + bonus;

  // Auction constructor parameters
  const priceStart = 500;
  const claimPeriod = 86400 * 7;
  const proxyAddress = accounts[0];

  // Deploy
  deployer.deploy(DutchAuction, priceStart, claimPeriod, proxyAddress).then(function () {
    return deployer.deploy(ShopToken, DutchAuction.address, initialSupply, auctionSupply);
  });
};
