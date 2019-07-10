const HDWalletProvider = require('truffle-hdwallet-provider');

const fs = require('fs');
const mnemonic = fs.readFileSync(".secret").toString().trim(); // 0x7103ff712AB6CB0B995cEBcf3257833aF8357274

module.exports = {
  networks: {

    development: {
     host: "127.0.0.1",     // Localhost (default: none)
     port: 8545,            // Standard Ethereum port (default: none)
     network_id: "*",       // Any network (default: none)
     gas: 5000000,
    },

    goerli: {
      gas: 5000000,
      gasPrice: 5000000000, // 5 gwei
      provider: () => {
        return new HDWalletProvider(mnemonic, 'https://goerli.infura.io/v3/7121204aac9a45dcb9c2cc825fb85159');
      },
      network_id: '5',
    },
    priv: {
      gas: 5000000,
      gasPrice: 5000000000, // 5 gwei
      host: '127.0.0.1',
      port: '8545',
      network_id: '*',
    },

  },

  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.5.9",    // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
       optimizer: {
         enabled: true,
         runs: 200
       },
       evmVersion: "petersburg"
      }
    }
  }
}
