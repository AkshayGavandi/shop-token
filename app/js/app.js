App = {
    network: null,
    web3: null,
    web3Provider: null,
    contracts: {},
    multiplier: Math.pow(10, 18),
    stageNames: {
      0: "Auction Deployed",
      1: "Auction Started",
      2: "Auction Ended",
      3: "Tokens Distributed",
    },
  
    init: function () {
      return App.initWeb3();
    },
  
    // Init Web3 Provider
    initWeb3: function () {
      // Is there an injected web3 instance?
      if (typeof web3 !== 'undefined') {
        console.log("Injected web3 instance detected");
        App.web3Provider = web3.currentProvider;
      } else {
        console.log("No injected web3 instance detected, falling back to Ganache");
        App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      }
  
      App.web3 = new Web3(App.web3Provider);
      console.log("web3 version:", App.web3.version.api);
      return App.initContract();
    },
  
    // Init contract
    initContract: function () {
      $.getJSON('DutchAuction.json', function (data) {
        console.log("Loading `DutchAuction` artifact");
        App.contracts.DutchAuction = TruffleContract(data);
        App.contracts.DutchAuction.setProvider(App.web3Provider);
        return App.showStatus();
      });
    },

    initNetwork: function() {
      App.web3.version.getNetwork(function (err, networkId) {
        if (err) {
          console.error("Error detecting network:", err);
        } else {
          console.log("Network ID:", networkId);
          App.htmlFadeIn('#currentNetwork', App.parseNetwork(networkId));
          App.network = networkId;
        }
      });      
    },

    htmlFadeIn: function(selector, value) {
      $(selector).hide().html(value).fadeIn('slow');
    },

    // Retrieve contract data and render
    showStatus: async function (token, account) {
      await App.initNetwork();
      
      App.contracts.DutchAuction.deployed()
        .then(function(instance) {
          $('.jumbotron p.status').fadeIn('slow');
          App.showJumbotron(instance);
          App.showCommon(instance);
          App.showTime(instance);
          App.showFinancial(instance);
          App.showAddresses(instance);
        })
        .catch(function(error) {
          $('.jumbotron p.status').hide();
          $('.jumbotron p.error').fadeIn('slow');
          console.error(error);
        })
    },    

    showJumbotron: async function(auctionContract) {
      const startPrice = await auctionContract.price_start.call();
      const currentPrice = await auctionContract.getPrice();
      const currentInterval = await auctionContract.getIntervals();
      const totalIntervals = await auctionContract.intervals.call(); 

      $('#currentPrice').prop('number', startPrice.toString()).animateNumber({ number: currentPrice.toString() }, 2500);
      $('#currentInterval').html(currentInterval.toString());
      $('#totalIntervals').html(totalIntervals.toString());
    },

    showCommon: async function(auctionContract) {
      const currentStage = await auctionContract.current_stage.call();
      const initialOffering = await auctionContract.initial_offering.call();
      const lastBonus = await auctionContract.last_bonus.call();
      
      const totalTokens = App.web3.fromWei(initialOffering.toNumber(), 'ether');
      const bonusTokens = App.web3.fromWei(lastBonus.toNumber(), 'ether');

      const totalTokensFormatted = new Intl.NumberFormat('en-US').format(totalTokens);
      const bonusTokensFormatted = new Intl.NumberFormat('en-US').format(bonusTokens);
    
      App.htmlFadeIn('#currentStage', App.stageNames[currentStage]);
      App.htmlFadeIn('#initialOffering', totalTokensFormatted);
      App.htmlFadeIn('#lastBonus', bonusTokensFormatted);
    },

    showTime: async function(auctionContract) {
      const startTime = await auctionContract.start_time.call();
      const endTime = await auctionContract.end_time.call();
      const claimPeriod = await auctionContract.claim_period.call();      
      
      App.htmlFadeIn('#startTime', moment(startTime.toString(), "X").fromNow());
      App.htmlFadeIn('#endTime', App.parseEndTime(endTime.toString()));
      App.htmlFadeIn('#claimPeriod', moment.duration(claimPeriod.toNumber(), "seconds").humanize());    
    },

    showFinancial: async function(auctionContract) {
      const minimumBid = await auctionContract.minimum_bid.call();
      const lastBid = await auctionContract.price_final.call();
      const receivedWei = await auctionContract.received_wei.call();
      const claimedWei = await auctionContract.claimed_wei.call();
      
      const minimalBid = App.web3.fromWei(minimumBid.toNumber(), 'kwei');
      const receivedFunds = App.web3.fromWei(receivedWei.toNumber(), 'ether');
      const claimedFunds = App.web3.fromWei(claimedWei.toNumber(), 'ether');
      
      App.htmlFadeIn('#minimumBid', minimalBid);
      App.htmlFadeIn('#lastBid', lastBid.toString());
      App.htmlFadeIn('#receivedFunds', receivedFunds);
      App.htmlFadeIn('#claimedFunds', claimedFunds);
    },

    showAddresses: async function(auctionContract) {
      const ownerAddress = await auctionContract.owner_address.call();
      const proxyAddress = await auctionContract.proxy_address.call();
      const walletAddress = await auctionContract.wallet_address.call();

      App.htmlFadeIn('#contractAddress', App.etherscanLink(auctionContract.address));
      App.htmlFadeIn('#ownerAddress', App.etherscanLink(ownerAddress));
      App.htmlFadeIn('#proxyAddress', App.etherscanLink(proxyAddress));
      App.htmlFadeIn('#walletAddress', App.etherscanLink(walletAddress));
    },

    etherscanLink: function(address) {
      let baseUrl;

      switch (App.network) {
        case "1":
          baseUrl = "https://etherscan.io/address";
          break;
        case "3":
          baseUrl = "https://ropsten.etherscan.io/address";
          break;
        case "4":
          baseUrl = "https://rinkeby.etherscan.io/address";
          break;
        case "42":
          baseUrl = "https://kovan.etherscan.io/address";
          break;
        default:
          baseUrl = "";
      }

      if (baseUrl != "") {
        return sprintf('<a href="%s/%s">%s</a>', baseUrl, address, address);
      } else {
        return address;
      }
    },

    parseEndTime: function (endTime) {
      if (endTime == "0") {
        return "❌";
      } else {
        return moment(endTime, "X").fromNow();
      }
    },

    parseNetwork: function(network_id) {
      let networkName;

      switch (network_id) {
        case "1":
          networkName = "Main";
          break;
        case "2":
          networkName = "Morden";
          break;
        case "3":
          networkName = "Ropsten";
          break;
        case "4":
          networkName = "Rinkeby";
          break;
        case "42":
          networkName = "Kovan";
          break;
        default:
          networkName = "Unknown";
      }

      return networkName;
    },   
  };
  
  $(function () {
    $(window).ready(function () {
      App.init();
    });
  });