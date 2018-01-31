# SHOP Token

[![CircleCI](https://circleci.com/gh/comrse/shop-token.svg?style=svg&circle-token=8845e1996d8ca21226b9a7b16ba52cfdf9bfff9e)](https://circleci.com/gh/comrse/shop-token)

Smart contracts for SHOP token and sale in form of [Dutch auction](https://en.wikipedia.org/wiki/Dutch_auction).

# Details

Auction duration is **30 days**, price per token unit exponentially decreases every day, all token units are being sold by the final bid price.

We're using [:page_facing_up: Pre-calculated Price Decay Rates](https://docs.google.com/spreadsheets/d/1ZqdmBoNK8sbgroBIxnbt9xCebFIfFZAtflxKLkSrplQ/edit?usp=sharing) to avoid overflows and reduce computations (and therefore, gas price) during bidding.

Auction stages:
* `AuctionDeployed`
* `AuctionSetup`
* `AuctionStarted`
* `AuctionEnded`

# Dependencies

* [Node.js](https://nodejs.org) ^9.4.0
* [Yarn](https://yarnpkg.com)

# Contributing

Thanks for considering to help out with our source code! We operate on an open
contributor model where anyone across the Internet can help in the form of peer
review, testing, and patches.

For more details about how to get involved, see our
[Contribution Guide](https://github.com/comrse/shop-token/blob/master/CONTRIBUTING.md)

# License

MIT
