const Keyring = require('@polkadot/keyring').default;
const stringToU8a = require('@polkadot/util/string/toU8a').default;
const { u8aToHex } = require('@polkadot/util/u8a');
const { decodeAddress } = require('@polkadot/keyring');

// Generates a Polkadot address from `seed`.
const getPolkadotAddress = (seed) => {
  seed = seed.padEnd(32, ' ');
  const keyring = new Keyring();
  const pair = keyring.addFromSeed(stringToU8a(seed));
  return keyring.getPair(pair.address()).address();
};

// Decodes from the SS58 encoded address to pubKey.
const decodeToPubKey= (polkadot) => {
  return u8aToHex(decodeAddress(polkadot));
}

module.exports = {
  getPolkadotAddress,
  decodeToPubKey,
};
