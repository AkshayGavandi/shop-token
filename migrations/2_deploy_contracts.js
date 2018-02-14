var DutchAuction = artifacts.require("DutchAuction");
var ShopToken = artifacts.require("ShopToken");

module.exports = function (deployer, network, accounts) {
  // Mint 1B tokens, transfer 100K for dutch auction
  const multiplier = 10 ** 18;

  // Token constructor parameters
  const initialSupply = (10 ** 9) * multiplier;
  const offering = 10000;
  const bonus = 500;
  const auctionSupply = offering + bonus;

  // Start with 500 Wei price per token unit
  const priceStart = 500;

  // Proxy address to place BTC bids
  const proxyAddress = accounts[0];

  // Deploy
  deployer.deploy(DutchAuction, priceStart, proxyAddress).then(function () {
    return deployer.deploy(ShopToken, DutchAuction.address, initialSupply, auctionSupply);
  });
};
