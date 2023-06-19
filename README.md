# Project setup

In order to run any of the examples, execute the following steps:

```bash
npm init
npm install --save @hashgraph/sdk
npm install dotenv

# Create .env file
touch .env

# Add your operator ID (OPERATOR_ID) and operator key (OPERATOR_PVKEY) to .env file

# Then run the example you want
node case-1.js 
```

# Royalty fee
**Definition:** Royalty fee charges a fraction of the value exchanged in a NFT transfer transaction. The fractional value is set by designating the numerator and denominator of the fraction.

**Fields:**
- numerator
- denumerator
- fallback fee(Fixed fee)
- fee collector account

**Docs:**
[Royalty Fee docs](https://docs.hedera.com/guides/docs/sdks/tokens/custom-token-fees#royalty-fee)

## How to set a custom roaylty fee?

Here's an example of a custom royalty fee where we charge a 50% fee on the exchanged value each time an NFT from this collection is transferred. Besides that, if the user doesn't add an Hbar transfer (exchanged value) to an NFT transfer transaction, we want the user to pay a fallback fee of 1 Hbar.

```js
// DEFINE CUSTOM FEE SCHEDULE (50% royalty fee - 5/10ths)
let nftCustomFee = new CustomRoyaltyFee()
    .setNumerator(5)
    .setDenominator(10)
    .setFeeCollectorAccountId(treasuryId)
    //the fallback fee is set to 1 hbar.
    .setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(1)));

// CREATE NFT WITH CUSTOM FEE
let nftCreate = await new TokenCreateTransaction()
    .setTokenName("Fall Collection")
    .setTokenSymbol("LEAF")
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryId)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(5)
    .setCustomFees([nftCustomFee])
    .setAdminKey(adminKey)
    .setSupplyKey(supplyKey)
    .freezeWith(client)
    .sign(treasuryKey);

let nftCreateTxSign = await nftCreate.sign(adminKey);
let nftCreateSubmit = await nftCreateTxSign.execute(client);
let nftCreateRx = await nftCreateSubmit.getReceipt(client);
let tokenId = nftCreateRx.tokenId;
console.log(`Created NFT with Token ID: ${tokenId} \n`);
```

It's also possible to exempt fee collectors from paying royalty fees when they transfer NFTs. With the implementation of [HIP-573](https://hips.hedera.com/hip/hip-573) on mainnet in release v0.31 (November 10th, 2022), you can exempt collection accounts from paying custom fees when exchanging token units, fungible tokens, or non-fungible tokens. This [tutorial](https://hedera.com/blog/how-to-exempt-hedera-accounts-from-custom-token-fees) explains the complete setup, but here's a quick snippet showing how to do it.


## Test cases:

### Case 1
**What happens if there is no fungible value exchanged in a NFT transfer and royalty fee schedule defines a fallback fee?** (expected: fallback fee)

**Output:**

Fallback fee has been set to 1 Hbar. If you comment out the ".setFallbackFee" line, nothing will be charged when transfering an NFT from this token. 

```text
- Treasury balance: 5 NFTs of ID:0.0.48289984 and 5 ℏ
- Alice balance: undefined NFTs of ID:0.0.48289984 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48289984 and 30 ℏ

 NFT transfer Treasury->Alice status: SUCCESS 

- Treasury balance: 4 NFTs of ID:0.0.48289984 and 5 ℏ
- Alice balance: 1 NFTs of ID:0.0.48289984 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48289984 and 30 ℏ

 NFT transfer Alice->Bob status: SUCCESS 

- Treasury balance: 4 NFTs of ID:0.0.48289984 and 6 ℏ
- Alice balance: 0 NFTs of ID:0.0.48289984 and 30 ℏ
- Bob balance: 1 NFTs of ID:0.0.48289984 and 29 ℏ
```

### Case 2
**What happens if there is no fungible value exchanged in a NFT transfer and the royalty fee schedule doesn't define a fallback fee?**

**Output:**

Nothing will be charged when transfering the NFT.

```text
- Treasury balance: 5 NFTs of ID:0.0.48289984 and 5 ℏ
- Alice balance: undefined NFTs of ID:0.0.48289984 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48289984 and 30 ℏ

 NFT transfer Treasury->Alice status: SUCCESS 

- Treasury balance: 4 NFTs of ID:0.0.48289984 and 5 ℏ
- Alice balance: 1 NFTs of ID:0.0.48289984 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48289984 and 30 ℏ

 NFT transfer Alice->Bob status: SUCCESS 

- Treasury balance: 4 NFTs of ID:0.0.48289984 and 5 ℏ
- Alice balance: 0 NFTs of ID:0.0.48289984 and 30 ℏ
- Bob balance: 1 NFTs of ID:0.0.48289984 and 30 ℏ
```

### Case 3
**What happens if there is no fungible value exchanged in a NFT transfer and the buyer does not have the fixed fee fallback token but is associated to the fallback token?** (expected: fail)

**Output:**

Fails with insufficient balance error for Bob (buyer) because he has 0 tokens: `INSUFFICIENT_SENDER_ACCOUNT_BALANCE_FOR_CUSTOM_FEE`. The same error is thrown when he has 1 or 2 tokens of this random token and the fallback fee is set to a higher amount for this token.

```text
- Treasury balance: 5 NFTs of ID:0.0.48294326 and 5 ℏ
- Alice balance: undefined NFTs of ID:0.0.48294326 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48294326 and 30 ℏ

 NFT transfer Treasury->Alice status: SUCCESS 

- Treasury balance: 4 NFTs of ID:0.0.48294326 and 5 ℏ
- Alice balance: 1 NFTs of ID:0.0.48294326 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48294326 and 30 ℏ

ReceiptStatusError: receipt for transaction 0.0.47741098@1663679731.363621682 contained error status INSUFFICIENT_SENDER_ACCOUNT_BALANCE_FOR_CUSTOM_FEE
...
```

### Case 4
**What happens if there is no fungible value exchanged in a NFT transfer and the buyer is not associated with the fixed fee fallback token?** (expected: fail)

**Output:**

Transfering the NFT from treasury->Alice succeeds because no custom fees are charged when transfering an NFT in/out the treasury account. Next, the transfer between Alice->Bob fails because Bob has to pay the fallback fee (no value exchanged) but he is not associated to the random token. Error: `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT`.

```text
- Treasury balance: 5 NFTs of ID:0.0.48290038 and 5 ℏ
- Alice balance: undefined NFTs of ID:0.0.48290038 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48290038 and 30 ℏ

 NFT transfer Treasury->Alice status: SUCCESS 

- Treasury balance: 4 NFTs of ID:0.0.48290038 and 5 ℏ
- Alice balance: 1 NFTs of ID:0.0.48290038 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48290038 and 30 ℏ

ReceiptStatusError: receipt for transaction 0.0.47741098@1663666531.902932804 contained error status TOKEN_NOT_ASSOCIATED_TO_ACCOUNT
...
```


### Case 5
**What happens when you create an NFT but the fee collector account is not associated with the fallback fee (CustomFixedFee)?** (expected: fail)

[Docs: Dissociate tokens](https://docs.hedera.com/guides/docs/sdks/tokens/dissociate-tokens-from-an-account)

**Output:**

The code will fail when sending the `TokenCreateTransaction` with the error: `TOKEN_NOT_ASSOCIATED_TO_FEE_COLLECTOR`.


### Case 6
**What happens when you add a random token as custom royalty fee to an NFT and then delete this random token on the ledger?** (expected: fail)

**Output:**

As the docs for [deleting a token](https://docs.hedera.com/guides/docs/sdks/tokens/delete-a-token) mention, it will throw an error `TOKEN_WAS_DELETED` when trying to transfer this NFT when no value is exchanged. 

It means that you can only exchange this NFT when transfering Hbar value. 

```text
 NFT transfer Treasury->Alice status: SUCCESS 

- Treasury balance: 5 ℏ NFTs of ID:0.0.48290163 4 and rand token: 980
- Alice balance: 20 ℏ NFTs of ID:0.0.48290163 1 and rand token: 10
- Bob balance: 20 ℏ NFTs of ID:0.0.48290163 0 and rand token: 10

- Random token deleted

ReceiptStatusError: receipt for transaction 0.0.47741098@1663668783.262812175 contained error status TOKEN_WAS_DELETED
...
```

### Case 7
**Can you update the royalty fee for NFTs to any number above 100%?** (expected: 100% is maximum)

**Output:**

This example first sets the royalty fee to 50% (5/10ths) and then updates the fee to 200% (200/100ths). However, the `TokenFeeScheduleUpdateTransaction` fails with the error `ROYALTY_FRACTION_CANNOT_EXCEED_ONE` which means that 100% is the maximum fee you can charge. 

```text
- Creating accounts...
- Created NFT with Token ID 0.0.2748981 and fee schedule 5/10ths

ReceiptStatusError: receipt for transaction 0.0.2617920@1675082562.837054051 contained error status ROYALTY_FRACTION_CANNOT_EXCEED_ONE
...
```

### Case 8
**Can you steal funds from someone's account that has auto-association slots available by sending them an NFT with a fallback fee?**

**Output:**

No, stealing funds is impossible because the account receiving the NFT has to sign the fallback fee being withdrawn from their account's balance. Without the receiving user's signature, you'll get an `INVALID_SIGNATURE` error.

```text
ReceiptStatusError: receipt for transaction 0.0.2617920@1687175554.994288926 contained error status INVALID_SIGNATURE
...
```

