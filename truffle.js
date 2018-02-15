require('babel-register')({
  ignore: /node_modules\/(?!zeppelin-solidity)/
});
require('babel-polyfill');

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    },
    coverage: {
      host: "localhost",
      network_id: "*",
      port: 8555,
      gas: 0xfffffffffff,
      gasPrice: 0x01
    },
    rinkeby: {
      host: "localhost",
      port: 8545,
      network_id: "4",
      from: "0x9ef45f76996492c1c2f214ae28e7145354186f10",
    }
  }
};
