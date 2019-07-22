const Web3 = require('web3');
// const HDWalletProvider = require('truffle-hdwallet-provider');

const fs = require('fs');
// const mnemonic = fs.readFileSync(".secret").toString().trim(); // 0x7103ff712AB6CB0B995cEBcf3257833aF8357274

// const web3 = new Web3(new Web3.providers.WebsocketProvider('ws://127.0.0.1:8546'))
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));

const FrozenToken = require('../build/contracts/FrozenToken.json');
const Claims = require('../build/contracts/Claims.json');

const myUtils = require('./utils.js');

(async () => {
  const accounts = await web3.eth.getAccounts();

  const sender = accounts[0];
  // const bal = await web3.eth.getBalance(sender);

  const netId = await web3.eth.net.getId();

  const frozenToken = new web3.eth.Contract(FrozenToken.abi, FrozenToken.networks[netId.toString()].address);
  const claims = new web3.eth.Contract(Claims.abi, Claims.networks[netId.toString()].address);

  console.log(claims.options.address);

  console.log(await frozenToken.methods.balanceOf(sender).call());

  // First do distribution of all 100 tokens.
  let n = 150;
  let myAccounts = [];
  let distributionPromise = [];
  while (n > 0) {
    const account = web3.eth.accounts.create();
    myAccounts.push(account);
    // fs.appendFileSync('./data', JSON.stringify(account));
    // fs.appendFileSync('./addresses', account.address);
    if (n < 100) {
      distributionPromise.push(
        frozenToken.methods.transfer(account.address, '1').send({
          from: sender,
          gas: '333333',
        }).on('transactionHash', (hash) => fs.appendFileSync('./txHashes', hash))
      );
    } else {
      fs.appendFileSync('testAllocations.csv', account.address+','+'1'+'\n');
    }
    n--;
  }

  await Promise.all(distributionPromise);

  await Promise.all(myAccounts.map(async (account, index) => {
    fs.appendFileSync('./privateKeys', account.privateKey + '\n');

    if (index % 2 == 0) {
      await web3.eth.sendTransaction({
        from: sender,
        to: account.address,
        value: '10000000000000000', 
      });

    
      const dot = myUtils.decodeToPubKey(myUtils.getPolkadotAddress(account.address.slice(0, 14)));
      const data = claims.methods.claim(account.address, dot).encodeABI();

      const rawTx = await account.signTransaction({
        to: claims.options.address,
        data: data,
        gas: '1000000',
      });

      return web3.eth.sendSignedTransaction(rawTx.rawTransaction).on('receipt', console.log);
    } else {
      fs.appendFileSync('testVesting.csv', account.address +',' + '1'+'\n');
      fs.appendFileSync('testIndices.csv', account.address +',');
      const amendedAccount = web3.eth.accounts.create();
      fs.appendFileSync('testAmends.csv', account.address+','+amendedAccount.address+'\n');

    }
  }));

  console.log('done'); process.exit(0);
})();
