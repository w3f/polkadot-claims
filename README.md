# Claims

The Polkadot Claims contract is used as the on-chain document that contains relevant information
for the generation of the initial state of Polkadot. It is the sibling contract to the [DOT Allocation][dot allocation]
contract. The DOT Allocation contract holds the mapping of Ethereum addresses to a token amount,
as recorded in the first public sale as well as ongoing transfers made by Web3 Foundation.
The Claims contract holds additional metadata such as the **index**, the **vesting status**, any
**amended** logic necessary for addresses that should be overwritten, and finally a **Polkadot address**
that will get entered into the genesis chain specification.

## Audit

The Claims contract has undergone an [audit][audit] before the first deployment for the Kusama network.

### Changes since the audit

- An additional storage item `claimsForPubkey` that allows for easy lookup of the Ethereum addresses associated with a Polkadot public key.
- The `balanceOfPubkey` function that takes a Polkadoy public key as an argument and
returns the sum of all the claims for this public key as well as any associated sale amount.
- In the `claim` function, an array push was added for the `claimsForPubkey` storage item.
- The addition of the `injectSaleAmount` function that allows owner to inject amounts
to associate with a public key. These amounts are "stackable" meaning that if 
there is more than one time someone used the same public key to buy in the second sale
we simply sum the two contribution amounts together.

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

[dot allocation]: https://etherscan.io/token/0xb59f67a8bff5d8cd03f6ac17265c550ed8f33907
[audit]: https://chainsecurity.com/wp-content/uploads/2019/08/ChainSecurity_W3F.pdf
