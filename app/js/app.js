App = {
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
      return App.initContract();
    },
  
    // Init contract
    initContract: function () {
      console.log("Network:", this.parseNetwork(this.web3.version.network))
  
      $.getJSON('DutchAuction.json', function (data) {
        console.log("Loaded `DutchAuction` artifact");
        App.contracts.DutchAuction = TruffleContract(data);
        App.contracts.DutchAuction.setProvider(App.web3Provider);
        return App.showStatus();
      });
    },

    htmlFadeIn: function(selector, value) {
      $(selector).hide().html(value).fadeIn('slow');
    },

    // Retrieve contract data and render
    showStatus: async function (token, account) {
      const auctionContract = await App.contracts.DutchAuction.deployed();
      
      this.showJumbotron(auctionContract);
      this.showCommon(auctionContract);
      this.showTime(auctionContract);
      this.showFinancial(auctionContract);
      this.showAddresses(auctionContract);
    },    

    showJumbotron: async function(auctionContract) {
      $('#currentNetwork').html(this.parseNetwork(this.web3.version.network))
      const startPrice = await auctionContract.price_start.call();
      const currentPrice = await auctionContract.getPrice();
      const currentInterval = await auctionContract.getIntervals();
      const totalIntervals = await auctionContract.intervals.call(); 

      $('#currentPrice').prop('number', startPrice.toString()).animateNumber({ number: currentPrice.toString() }, 2500);
      this.htmlFadeIn('#currentInterval', currentInterval.toString());
      this.htmlFadeIn('#totalIntervals', totalIntervals.toString());
    },

    showCommon: async function(auctionContract) {
      const currentStage = await auctionContract.current_stage.call();
      const initialOffering = await auctionContract.initial_offering.call();
      const lastBonus = await auctionContract.last_bonus.call();
      
      const totalTokens = new Intl.NumberFormat('en-US').format(web3.fromWei(initialOffering.toNumber(), 'ether'));
      const bonusTokens = new Intl.NumberFormat('en-US').format(web3.fromWei(lastBonus.toNumber(), 'ether'));
    
      this.htmlFadeIn('#currentStage', this.stageNames[currentStage]);
      this.htmlFadeIn('#initialOffering', totalTokens);
      this.htmlFadeIn('#lastBonus', bonusTokens);
    },

    showTime: async function(auctionContract) {
      const startTime = await auctionContract.start_time.call();
      const endTime = await auctionContract.end_time.call();
      const claimPeriod = await auctionContract.claim_period.call();      
      
      this.htmlFadeIn('#startTime', moment(startTime.toString(), "X").fromNow());
      this.htmlFadeIn('#endTime', this.parseEndTime(endTime.toString()));
      this.htmlFadeIn('#claimPeriod', moment.duration(claimPeriod.toNumber(), "seconds").humanize());    
    },

    showFinancial: async function(auctionContract) {
      const minimumBid = await auctionContract.minimum_bid.call();
      const lastBid = await auctionContract.price_final.call();
      const receivedWei = await auctionContract.received_wei.call();
      const claimedWei = await auctionContract.claimed_wei.call();
      
      const minimalBid = web3.fromWei(minimumBid.toNumber(), 'kwei');
      const receivedFunds = web3.fromWei(receivedWei.toNumber(), 'ether');
      const claimedFunds = web3.fromWei(claimedWei.toNumber(), 'ether');
      
      this.htmlFadeIn('#minimumBid', minimalBid);
      this.htmlFadeIn('#lastBid', lastBid.toString());
      this.htmlFadeIn('#receivedFunds', receivedFunds);
      this.htmlFadeIn('#claimedFunds', claimedFunds);
    },

    showAddresses: async function(auctionContract) {
      const ownerAddress = await auctionContract.owner_address.call();
      const proxyAddress = await auctionContract.proxy_address.call();
      const walletAddress = await auctionContract.wallet_address.call();

      this.htmlFadeIn('#contractAddress', this.etherscanLink(auctionContract.address));
      this.htmlFadeIn('#ownerAddress', this.etherscanLink(ownerAddress));
      this.htmlFadeIn('#proxyAddress', this.etherscanLink(proxyAddress));
      this.htmlFadeIn('#walletAddress', this.etherscanLink(walletAddress));
    },

    etherscanLink: function(address) {
      let baseUrl;

      switch (App.web3.version.network) {
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