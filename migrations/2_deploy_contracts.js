const Claims = artifacts.require('Claims');
const FrozenToken = artifacts.require('FrozenToken');

module.exports = async (deployer) => {
  try {
    console.log('here');
    const accounts = await web3.eth.getAccounts();
    await deployer.deploy(FrozenToken, 1000, accounts[0]);
    await deployer.deploy(Claims, accounts[0], FrozenToken.address);
  } catch (e) { console.error(e); }
}
