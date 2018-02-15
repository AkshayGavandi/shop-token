// Dutch auction constructor parameters
const priceStart = 500;
const pricePrecision = 1;
const minimumBid = 1000;
const claimPeriod = 86400 * 7;
const offering = 10 ** 4;
const bonus = 500;

// Token constructor parameters
const multiplier = 10 ** 18;
const initialSupply = (10 ** 9) * multiplier;
const auctionSupply = offering + bonus;
const tokenSupply = initialSupply - auctionSupply;

module.exports = {
  priceStart,
  pricePrecision,
  minimumBid,
  claimPeriod,  
  offering,
  bonus,
  multiplier,
  initialSupply,
  auctionSupply,
  tokenSupply
};
