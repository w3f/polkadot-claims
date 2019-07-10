const Claims = artifacts.require('Claims');
const FrozenToken = artifacts.require('FrozenToken');

const { expect } = require('chai');
const Keyring = require('@polkadot/keyring').default;
const stringToU8a = require('@polkadot/util/string/toU8a').default;
const { u8aToHex } = require('@polkadot/util/u8a');
const { decodeAddress } = require('@polkadot/keyring');

// Turn ON / OFF logging
const NOISY = false;

const assertRevert = async (transaction, expectedErr) => {
  try {
    const res = await transaction
    assert(!res, "Transaction did not revert like expected");
  } catch (e) {
    const errString = e.toString();
    assert(
      errString.indexOf('VM Exception while processing transaction: revert') !== -1
    );
    if (expectedErr) {
      assert(
        errString.indexOf(expectedErr) !== -1,
        "Expected error string NOT FOUND"
      );
    }
  }
};

const findEventFromReceipt = (receipt, eventName) => (
  receipt.logs.find(log => log.event === eventName)
);

const deployGas = async (contract, name) => {
  if (!NOISY) return;

  const { transactionHash } = contract;
  if (!transactionHash) {
    throw new Error('Transaction hash not found on contract object');
  }
  const receipt = await web3.eth.getTransactionReceipt(transactionHash);
  console.log(
`
${name}
----------------
Deploy Gas Used - ${receipt.gasUsed}
`
  );
};

const txGas = (tx, name) => {
  if (!NOISY) return;

  console.log(
`
${name}
---------------
Tx Gas - ${tx.receipt.gasUsed}
`
  );
};

const getPolkadotAddress = (seed) => {
  seed = seed.padEnd(32, ' ');
  const keyring = new Keyring();
  const pair = keyring.addFromSeed(stringToU8a(seed));
  return keyring.getPair(pair.address()).address();
};

contract('Claims', accounts => {

  let owner = accounts[0];
  let claims, frozenToken;

  before(async () => {
    frozenToken = await FrozenToken.new(
      '10000000',
      owner,
    );
    expect(frozenToken.address).to.exist;
    deployGas(frozenToken, 'Frozen Token');

    // Set up the token with a bunch of balances.
    let nSends = 3;
    const makeSends = async (num) => {

      let i = 1;
      while (i < num+1) {
        await frozenToken.transfer(accounts[i], 10000);
        i++;
      }
    }

    await makeSends(nSends);

    claims = await Claims.new(
      owner,
      frozenToken.address,
    );
    expect(claims.address).to.exist;
    deployGas(claims, 'Claims');
  });

  it('Allows assigning of the 0 index', async () => {
    // Sanity
    const nextIndex = await claims.nextIndex();
    expect(nextIndex.toString()).to.equal('0');

    const assignTx = await claims.assignIndices([accounts[1]]);
    expect(assignTx.receipt).to.exist;
    const event = findEventFromReceipt(assignTx.receipt, 'IndexAssigned');
    const { eth, idx } = event.args;
    expect(eth).to.equal(accounts[1]);
    expect(idx.toString()).to.equal('0');

    const nextIndexAfter = await claims.nextIndex();
    expect(nextIndexAfter.toString()).to.equal('1');
  });

  it('Allows owner to amend a new Ethereum address for a lost key', async () => {
    const amended = accounts[4];
    const orig = accounts[2];
    const txResult = await claims.amend([orig], [amended]);
    expect(txResult.receipt).to.exist;
    const event = findEventFromReceipt(txResult.receipt, 'Amended');
    expect(event).to.exist;
    const { original, amendedTo } = event.args;
    expect(original).to.equal(orig);
    expect(amendedTo).to.equal(amended);
    
    const amendedRes = await claims.amended(orig);
    expect(amendedRes).to.equal(amended);
  });

  it('Allows for owner to amend indefinitely', async () => {
    // Change it
    await claims.amend([accounts[2]], [accounts[6]]);
    const amended = await claims.amended(accounts[2]);
    expect(amended).to.equal(accounts[6]);

    // Change it back
    await claims.amend([accounts[2]], [accounts[4]]);
    const amendedBack = await claims.amended(accounts[2]);
    expect(amendedBack).to.equal(accounts[4]);
  });

  it('Invariant: Does not allow anyone besides owner to amend', async () => {
    assertRevert(
      claims.amend([accounts[1]], [accounts[5]], { from: accounts[7] }),
      "Only owner"
    );
    assertRevert(
      claims.amend([accounts[1]], [accounts[5]], { from: accounts[9] }),
      "Only owner"
    );
  });

  it('Invariant: Does not allow a claim from non allocation or amended address', async () => {
    const pAddr = getPolkadotAddress('Alice');
    const decoded = u8aToHex(decodeAddress(pAddr));
    await assertRevert(
      claims.claim(accounts[1], decoded, { from: accounts[0] }),
      "Sender is not the allocation address"
    );
  });

  it('Allows an allocation address claim to Polkadot address', async () => {
    const pAddr = getPolkadotAddress('Alice');
    const decoded = u8aToHex(decodeAddress(pAddr));
    const txResult = await claims.claim(accounts[3], decoded, { from: accounts[3] });
    expect(txResult.receipt).to.exist;
    const event = findEventFromReceipt(txResult.receipt, 'Claimed');
    expect(event).to.exist;
    const { eth, dot, idx } = event.args;
    expect(eth).to.equal(accounts[3]);
    expect(dot).to.equal(decoded);
    expect(idx.toString()).to.equal('1');

    // Sanity 
    const nextIndex = await claims.nextIndex();
    expect(nextIndex.toString()).to.equal('2');
  });

  it('Allows the accounts assigned 0 index to claim', async () => {
    const pAddr = getPolkadotAddress('Charlie');
    const decoded = u8aToHex(decodeAddress(pAddr));
    const txResult = await claims.claim(accounts[1], decoded, { from: accounts[1] });
    expect(txResult.receipt).to.exist;
    const event = findEventFromReceipt(txResult.receipt, 'Claimed');
    expect(event).to.exist;
    const { eth, dot, idx } = event.args;
    expect(eth).to.equal(accounts[1]);
    expect(dot).to.equal(decoded);
    expect(idx.toString()).to.equal('0');

    // Sanity 
    const nextIndex = await claims.nextIndex();
    expect(nextIndex.toString()).to.equal('2');
  });

  it('Invariant: Does not allow vesting to be set for a claimed address', async () => {
    await assertRevert(
      claims.setVesting([accounts[1]], [1]),
      "Account must not be claimed"
    );
  });

  it('Invariant: Does not allow to amend an address that already claimed', async () => {
    await assertRevert(
      claims.amend([accounts[1]], [accounts[7]]),
      'Address has already claimed'
    );
  });

  it('Invariant: Does not allow to change claim address', async () => {
    const pAddr = getPolkadotAddress('Bob');
    const decoded = u8aToHex(decodeAddress(pAddr));
    await assertRevert(
      claims.claim(accounts[1], decoded, { from: accounts[1] }),
      'Account has already claimed'
    );
  });

  it('Allows anyone to call assignIndices', async () => {
    // Sanity
    const nextIndex = await claims.nextIndex();
    expect(nextIndex.toString()).to.equal('2');

    const txResult = await claims.assignIndices([accounts[2]], { from: accounts[9] });
    txGas(txResult, 'Claims::assignNextIndex()');

    // Did nextIndex increment?
    const nextIndexAfter = await claims.nextIndex();
    expect(
      nextIndexAfter.toString()
    ).to.equal('3');

    // Did IndexAssigned get propagated? With the expected values?
    const event = findEventFromReceipt(txResult.receipt, 'IndexAssigned');
    expect(event).to.exist;
    const { eth, idx } = event.args;
    expect(eth).to.equal(accounts[2]);
    expect(idx.toString()).to.equal('2');
  });

  it('Invariant: Does not allow an index to be assigned to non-allocation account', async () => {
    // Sanity
    const nextIndex = await claims.nextIndex();
    expect(nextIndex.toString()).to.equal('3')

    await assertRevert(
      claims.assignIndices([accounts[4]]),
      'Ethereum address has no DOT allocation'
    );

    // Sanity After
    const nextIndexAfter = await claims.nextIndex();
    expect(nextIndexAfter.toString()).to.equal('3')
  });

  it('Invariant: Does not allow the reassignment of an index', async () => {
    await assertRevert(
      claims.assignIndices([accounts[2]]),
      'Cannot reassign an index'
    );
  });

  it('Invariant: Does not allow an old amendment to claim', async () => {
    const pAddr = getPolkadotAddress('Bob');
    const decoded = u8aToHex(decodeAddress(pAddr));

    await assertRevert(
      claims.claim(accounts[2], decoded, { from: accounts[6] }),
      'Address is amended and sender is not the amendment'
    );
  });

  it('Allows owner to set vesting on an unclaimed addresses', async () => {
    const txResult = await claims.setVesting([accounts[2]], [1]);
    
    // Check for state change.
    const claim = await claims.claims(accounts[2]);
    expect(claim.vested.toString()).to.equal('1');
  });

  it('Invariant: Does not allow for vesting to be set twice', async () => {
    await assertRevert(
      claims.setVesting([accounts[2]], [2]),
      'Account must not be vested already'
    );
  });

  it('Allows an amended address to claim to Polkadot address', async () => {
    const pAddr = getPolkadotAddress('Bob');
    const decoded = u8aToHex(decodeAddress(pAddr));
    const txResult = await claims.claim(accounts[2], decoded, { from: accounts[4] });
    expect(txResult.receipt).to.exist;
    const event = findEventFromReceipt(txResult.receipt, 'Claimed');
    expect(event).to.exist;
    const { eth, dot, idx } = event.args;
    expect(eth).to.equal(accounts[2]);
    expect(dot).to.equal(decoded);
    expect(idx.toString()).to.equal('2');

    // Check index incremented.
    const curIdx = await claims.nextIndex();
    expect(curIdx.toString()).to.equal('3');
  });

  it('Invariant: Does not allow `hasClaimed` call to be made on a non-allocation address', async () => {
    // First make sure it works as we expect
    const hasClaimed = await claims.hasClaimed(accounts[2]);
    expect(hasClaimed).to.be.true;
    // Then make sure it reverts like we expect
    await assertRevert(
      claims.hasClaimed(accounts[8]),
      'Ethereum address has no DOT allocation'
    );
  });

  it('The data is as we expect', async () => {
    const claimed0 = await claims.claimed(0);
    expect(claimed0).to.equal(accounts[3]);
    const claimData0 = await claims.claims(claimed0);
    let { index, polkadot, vested } = claimData0;
    expect(index.toString()).to.equal('1');
    expect(polkadot).to.equal(u8aToHex(decodeAddress(getPolkadotAddress('Alice'))));
    expect(vested.toString()).to.equal('0');
    const claimed1 = await claims.claimed(1);
    expect(claimed1).to.equal(accounts[1]);
    const claimData1 = await claims.claims(claimed1);
    expect(claimData1.index.toString()).to.equal('0');
    expect(claimData1.polkadot).to.equal(u8aToHex(decodeAddress(getPolkadotAddress('Charlie'))));
    expect(claimData1.vested.toString()).to.equal('0');
    const claimed2 = await claims.claimed(2);
    expect(claimed2).to.equal(accounts[2]);
    const claimData2 = await claims.claims(claimed2);
    expect(claimData2.index.toString()).to.equal('2');
    expect(claimData2.polkadot).to.equal(u8aToHex(decodeAddress(getPolkadotAddress('Bob'))));
    expect(claimData2.vested.toString()).to.equal('1');
    const len = await claims.claimedLength();
    expect(len.toString()).to.equal('3');
  });
});
