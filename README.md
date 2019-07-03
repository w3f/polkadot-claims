# Claims

A smart contract that allows the Ethereum address associated with a DOT allocation to claim that allocation to a specified Polkadot address. 

## Functionality

- Allows an allocation Ethereum address to claim their allocation to a Polkadot address.
- Assigns indices, allows anyone to assign an index to any other account. Earlier assignments are lower.
- Allows W3F to amend Ethereum address in extreme circumstances.
- Allows W3F to set vesting of unclaimed addresses.

## Run the tests

Clone the repository locally and run the following commands.

```sh
yarn
yarn test
```

## Set-up state locally

In one terminal window:

```
$ ./startgeth.sh
```

In another terminal window:

```
$ yarn priv:deploy
$ node scripts/distribute.js
```

The script will mint frozenToken to 100 random addresses and make it so every other (index % 2) address will send a claim transaction. Private keys for these random addresses will be printed to a `privateKeys` text file and can be copied into Metamask or elsewhere.

