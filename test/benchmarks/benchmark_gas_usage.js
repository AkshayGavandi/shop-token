var DutchAuction = artifacts.require("./DutchAuction.sol");
var ShopToken = artifacts.require("./ShopToken.sol");

const increaseTime = require('zeppelin-solidity/test/helpers/increaseTime');
const BigNumber = require('bignumber.js');
const helpers = require('../lib/helpers.js');
const defaults = require('../lib/defaults.js');
const Table = require('cli-table');


module.exports = async function (callback) {
    let totalGas = 0;
    const coinbase = web3.eth.accounts[0];
    const proxyAddress = web3.eth.accounts[1];
    const startPrice = new BigNumber(20);

    // Standard Gas Price, 15 Feb 2018
    // From https://ethgasstation.info
    const gasPrice = web3.toWei(1, "gwei");

    // Assuming 1 ETH ~ $919
    const conversionRate = 919.274972;

    let stats = new Table({
      head: ['Operation', 'Gas Used', 'ETH Price', 'USD Price']
    });

    function accumulateStats(transactionHash, operation) {
        let receipt = web3.eth.getTransactionReceipt(transactionHash);
        saveStats(receipt.gasUsed, operation);        
        totalGas += receipt.gasUsed;
    }

    function saveStats(gasUsed, operation) {
        const gasCost = new BigNumber(gasUsed).multipliedBy(gasPrice);
        const gasCostETH = new BigNumber(web3.fromWei(gasCost, 'ether')).toFormat(8);
        const gasCostUSD = new BigNumber(gasCostETH).multipliedBy(conversionRate).toFormat(2);
        stats.push([operation, gasUsed, gasCostETH, '$' + gasCostUSD]);
    }

    // Measure DutchAuction() constructor
    const auctionContract = await DutchAuction.new(startPrice.toNumber(), proxyAddress);
    accumulateStats(auctionContract.transactionHash, "DutchAuction()");

    // Measure ShopToken() constructor
    const tokenContract = await ShopToken.new(auctionContract.address, defaults.initialSupply, defaults.auctionSupply);
    accumulateStats(tokenContract.transactionHash, "ShopToken()");

    // Measure setupAuction()
    const setupAuction = await auctionContract.setupAuction(tokenContract.address, defaults.offering, defaults.bonus);
    accumulateStats(setupAuction.tx, "setupAuction()");
    
    // Measure startAuction()
    const startAuction = await auctionContract.startAuction();
    accumulateStats(startAuction.tx, "startAuction()");

    // Measure placeBid()
    const placeBid = await auctionContract.sendTransaction({ from: coinbase, value: 1000 });
    accumulateStats(placeBid.tx, "placeBid()");

    // Measure placeBitcoinBid()
    const placeBitcoinBid = await auctionContract.placeBitcoinBid(proxyAddress, 1000, { from: proxyAddress });
    accumulateStats(placeBitcoinBid.tx, "placeBitcoinBid()");

    // Measure endAuction()
    const endAuction = await auctionContract.endAuction();
    accumulateStats(endAuction.tx, "endAuction()");

    // Measure claimTokens()
    // await increaseTime(helpers.byDays(8));    
    // const claimTokens = await auctionContract.claimTokens({ from: proxyAddress });
    // accumulateStats(claimTokens.tx, "claimTokens()");

    // Print stats table
    saveStats(totalGas, "OVERALL");
    console.log(stats.toString());
}