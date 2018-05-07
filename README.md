# SHOP Token

[![CircleCI](https://circleci.com/gh/ShoppersShop/shop-token.svg?style=svg)](https://circleci.com/gh/ShoppersShop/shop-token) [![dependencies Status](https://david-dm.org/ShoppersShop/shop-token/status.svg)](https://david-dm.org/ShoppersShop/shop-token) [![devDependencies Status](https://david-dm.org/ShoppersShop/shop-token/dev-status.svg)](https://david-dm.org/ShoppersShop/shop-token?type=dev)

**DEPRECATED** New version of smart contracts will be used for upcoming token release, source code can be found at [ShoppersShop/token-sale](https://github.com/ShoppersShop/token-sale). You can find more information in related [blog post](https://medium.com/@shoppers_shop/shop-token-release-model-enhancement-1a33e872864f).

Smart contracts for SHOP token and sale in form of [Dutch auction](https://en.wikipedia.org/wiki/Dutch_auction).

# Details

Auction duration is **30 days**, price per token unit exponentially decreases every day, all token units are being sold by the final bid price.

We're using [:page_facing_up: Pre-calculated Price Decay Rates](https://docs.google.com/spreadsheets/d/1L2JWqICu36N31yx_oH9bG9ypCr16tkKsXE37WythWjk/edit#gid=0) to avoid overflows and reduce computations (and therefore, gas price) during bidding.

Auction stages:
`AuctionDeployed` ⇒ `AuctionStarted` ⇒ `AuctionEnded` ⇒ `TokensDistributed`

# Dependencies

* [Node.js](https://nodejs.org) ^9.4.0
* [Yarn](https://yarnpkg.com)

# Contributing

Thanks for considering to help out with our source code! We operate on an open
contributor model where anyone across the Internet can help in the form of peer
review, testing, and patches.

For more details about how to get involved, see our
[Contribution Guide](https://github.com/ShoppersShop/shop-token/blob/master/CONTRIBUTING.md)

# License

MIT
