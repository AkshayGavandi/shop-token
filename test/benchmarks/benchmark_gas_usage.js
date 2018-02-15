var DutchAuction = artifacts.require("./DutchAuction.sol");
var ShopToken = artifacts.require("./ShopToken.sol");

const BigNumber = require('bignumber.js');
const helpers = require('../lib/helpers.js');
const defaults = require('../lib/defaults.js');
const Table = require('cli-table');
const sprintf = require('sprintf-js').sprintf;

module.exports = async function (callback) {
    let totalGas = 0;
    const coinbase = web3.eth.accounts[0];
    const proxyAddress = web3.eth.accounts[1];
    const startPrice = new BigNumber(20);

    // Average and Fastest Gas Prices, 15 Feb 2018
    // From https://ethgasstation.info
    const gasPriceAvg = web3.toWei(1, "gwei");
    const gasPriceFast = web3.toWei(20, "gwei");

    // Assuming 1 ETH ~ $919
    const conversionRate = 919.274972;

    let stats = new Table({
      head: ['Interface', 'Gas Used', 'ETH Avg Price', 'USD Avg Price', 'ETH Fast Price', 'USD Fast Price']
    });

    function accumulateStats(transactionHash, operation, inTotal) {
        let receipt = web3.eth.getTransactionReceipt(transactionHash);
        saveStats(receipt.gasUsed, operation);    
        
        if (inTotal) {
            totalGas += receipt.gasUsed;
        }
    }

    function saveStats(gasUsed, operation) {
        const gasCostAvg = new BigNumber(gasUsed).multipliedBy(gasPriceAvg);
        const gasCostAvgETH = new BigNumber(web3.fromWei(gasCostAvg, 'ether')).toFormat(8);
        const gasCostAvgUSD = new BigNumber(gasCostAvgETH).multipliedBy(conversionRate).toFormat(2);
        
        const gasCostFast = new BigNumber(gasUsed).multipliedBy(gasPriceFast);
        const gasCostFastETH = new BigNumber(web3.fromWei(gasCostFast, 'ether')).toFormat(8);
        const gasCostFastUSD = new BigNumber(gasCostFastETH).multipliedBy(conversionRate).toFormat(2);

        stats.push([
            operation, 
            gasUsed, 
            gasCostAvgETH, 
            sprintf("$%s", gasCostAvgUSD),
            gasCostFastETH,
            sprintf("$%s", gasCostFastUSD),
        ]);
    }

    // Measure DutchAuction() constructor
    const auctionContract = await DutchAuction.new(startPrice.toNumber(), 0, proxyAddress);
    accumulateStats(auctionContract.transactionHash, "DutchAuction()", true);

    // Measure ShopToken() constructor
    const tokenContract = await ShopToken.new(auctionContract.address, defaults.initialSupply, defaults.auctionSupply);
    accumulateStats(tokenContract.transactionHash, "ShopToken()", true);

    // Measure startAuction()
    const startAuction = await auctionContract.startAuction(tokenContract.address, defaults.offering, defaults.bonus);
    accumulateStats(startAuction.tx, "startAuction()", true);

    // Measure total deployment costs
    saveStats(totalGas, "DEPLOYMENT TOTAL");

    // Measure placeBid()
    const placeBid = await auctionContract.sendTransaction({ from: coinbase, value: 1000 });
    accumulateStats(placeBid.tx, "placeBid()", false);

    // Measure placeBitcoinBid()
    const placeBitcoinBid = await auctionContract.placeBitcoinBid(proxyAddress, 1000, { from: proxyAddress });
    accumulateStats(placeBitcoinBid.tx, "placeBitcoinBid()", false);

    // Measure endAuction()
    const endAuction = await auctionContract.endAuction();
    accumulateStats(endAuction.tx, "endAuction()", false);

    // Measure claimTokens()
    const claimTokens = await auctionContract.claimTokens({ from: proxyAddress });
    accumulateStats(claimTokens.tx, "claimTokens()", false);

    // Print stats table
    console.log(stats.toString());
}