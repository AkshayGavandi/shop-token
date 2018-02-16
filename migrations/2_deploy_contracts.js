const BigNumber = require('bignumber.js');

var DutchAuction = artifacts.require("DutchAuction");
var ShopToken = artifacts.require("ShopToken");

module.exports = function (deployer, network, accounts) {
  // Mint 1B tokens
  const multiplier = new BigNumber(10).pow(18).toString();
  const initialSupply = new BigNumber(10).pow(9).multipliedBy(multiplier).toString();

  // Prepare 100M tokens for sale + 5% oversubscription bonus
  const offering = new BigNumber(10).pow(8).multipliedBy(multiplier);
  const bonus = offering.multipliedBy(5).dividedBy(100);
  const auctionSupply = offering.plus(bonus).toString();

  // USDETH Rate - 0.0011, 16 Feb 2018
  // Start price - $19.99
  // Minimum bid amount - 100K wei
  const minimumBid = 100000;
  const pricePrecision = 100000;
  const priceStart = new BigNumber(19.99).multipliedBy(0.0011).multipliedBy(pricePrecision).toString();

  // Tokens can be claimed 7 days after auction ends
  const claimPeriod = 86400 * 7;

  // Wallet and proxy addresses  
  let walletAddress;
  let proxyAddress;

  if (network == "development" || network == "coverage") {
    walletAddress = accounts[1];
    proxyAddress = accounts[2];
  } else if (network == "rinkeby") {
    walletAddress = "0xe7f341e27fc39ee1a1f7093c83ce262696bb4b4d";
    proxyAddress = "0x8cf0f38f6d6b8c30b9aa3cd71d54b0b94638f725";
  }

  // Deploy contracts and start auction
  deployer.deploy(DutchAuction, priceStart, pricePrecision, minimumBid, claimPeriod, walletAddress, proxyAddress).then(function () {
    deployer.deploy(ShopToken, DutchAuction.address, initialSupply, auctionSupply).then(function() {
      DutchAuction.deployed().then(function(instance) {
        instance.startAuction(ShopToken.address, offering.toString(), bonus.toString());
      });
    });
  });
};
