pragma solidity ^0.4.17;

contract PriceDecay30 {
    // Auction duration, in intervals
    uint256 public intervals = 30;

    // Interval divider
    uint256 public interval_divider = 86400;

    // Precision for price calculation
    uint256 public precision = 10 ** 13;

    // Price decay rates per day
    uint256[30] public decayRates = [
        precision,
        7694472807310,
        5920491178244,
        4555505837691,
        3505221579166,
        2697083212449,
        2075263343724,
        1596805736629,
        1228657831905,
        945387427708,
        727425785487,
        559715792577,
        430671794580,
        331379241228,
        254978856053,
        196192787434,
        150960006790,
        116155766724,
        89375738847,
        68769919219,
        52914827339,
        40715170006,
        31328176846,
        24105380484,
        18547819465,
        14271569251,
        10981220152,
        8449469985,
        6501421703,
        5002501251
    ];

    // Returns current price
    function calcPrice(uint256 priceStart, uint256 currentInterval) internal view returns (uint256) {
        return (priceStart * decayRates[currentInterval]) / precision;
    }
}