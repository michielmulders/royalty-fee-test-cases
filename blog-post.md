# NFT Royalty Fees: Everything You Need To Know (Edge-cases Included)

When you create a new non-fungible token using the Hedera Token Service (HTS), you have the possibility to set one or multiple royalty fees. 

You can do this by using the [`CustomRoyaltyFee` method](https://docs.hedera.com/guides/docs/sdks/tokens/custom-token-fees#royalty-fee), which allows you to set all parameters for your custom NFT royalty fee. In its simplest form, each time an NFT is transferred, the Hedera network will charge a fraction of the value exchanged in this transaction. 

However, this does not apply when transfering from and to the token's treasury account. If you need to return the NFT to the treasury account, you should not have to pay for it. In the same way, it doesn't make sense for the treasury account to pay its royalty fee when sending out NFTs to collectors. 

This blog post will show multiple code examples illustrating the correct way to set a custom royalty fee and numerous edge cases to help you better understand how the Hedera network works. 

_If you want to play around with the [code examples](https://github.com/michielmulders/royalty-fee-test-cases) yourself, make sure you have a funded account you can use as the operator account to fund other accounts generated in the examples._

First, let's look at a regular custom royalty fee code snippet.

## How to set a custom royalty fee?

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

You can find the full code at [case-normal.js](https://github.com/michielmulders/royalty-fee-test-cases/blob/main/case-normal.js). This example completes multiple steps:

1. Transfer NFT from Treasury->Alice (no royalty fee)
2. Transfer NFT from Alice->Bob and Bob pays 10 Hbar to Alice (royalty fee is paid)
3. Transfer NFT from Bob->Treasury (no royalty fee)

If you execute the code at `case-normal.js`, you'll get the following output which nicely prints the differences in balances after each step.

```text
Starting balances:
- Treasury balance: 5 NFTs of ID:0.0.48830139 and 5 ℏ
- Alice balance: undefined NFTs of ID:0.0.48830139 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48830139 and 30 ℏ

 ---
 NFT transfer Treasury->Alice status: SUCCESS 

- Treasury balance: 4 NFTs of ID:0.0.48830139 and 5 ℏ
- Alice balance: 1 NFTs of ID:0.0.48830139 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48830139 and 30 ℏ

 ---
 NFT transfer Alice->Bob status: SUCCESS 

- Treasury balance: 4 NFTs of ID:0.0.48830139 and 10 ℏ (+5 Hbar = 50% royalty fee)
- Alice balance: 0 NFTs of ID:0.0.48830139 and 35 ℏ (+5 Hbar value exchange)
- Bob balance: 1 NFTs of ID:0.0.48830139 and 20 ℏ (- 10 Hbar)

 ---
 NFT transfer Bob->Treasury status: SUCCESS 

- Treasury balance: 5 NFTs of ID:0.0.48830139 and 10 ℏ
- Alice balance: 0 NFTs of ID:0.0.48830139 and 35 ℏ
- Bob balance: 0 NFTs of ID:0.0.48830139 and 20 ℏ
```

It's also possible to exempt fee collectors from paying royalty fees when they transfer NFTs. With the implementation of [HIP-573](https://hips.hedera.com/hip/hip-573) on mainnet in release v0.31 (November 10th, 2022), you can exempt collection accounts from paying custom fees when exchanging token units, fungible tokens or non-fungible tokens. This [tutorial](https://hedera.com/blog/how-to-exempt-hedera-accounts-from-custom-token-fees) explains the complete setup, but here's a quick snippet showing how to do it.

```js
const fee1 = new CustomFractionalFee()
       .setFeeCollectorAccountId(accountId1)
       .setNumerator(1)
       .setDenominator(100)
       .setAllCollectorsAreExempt(true); // new property to exempt fee collectors 

const fee2 = new CustomFractionalFee()
       .setFeeCollectorAccountId(accountId2)
       .setNumerator(2)
       .setDenominator(100)
       .setAllCollectorsAreExempt(true); // you have to set it for each fee you define
```

Now, let's take a look at some NFT custom royalty fee edge cases. 

## Edge case 1

**Question:** What happens if no fungible value is exchanged in an NFT transfer and the royalty fee schedule defines a fallback fee?

**Output:** The fallback fee of 1 Hbar is paid.

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

You can find the full code example at [`case-1.js`](https://github.com/michielmulders/royalty-fee-test-cases/blob/main/case-1.js).

## Edge case 2

**Question:** What happens if no fungible value is exchanged in an NFT transfer and the royalty fee schedule doesn't define a fallback fee?

**Output:** Nothing will be charged when transfering the NFT. In other words, if you don't set a fallback fee, the royalty fee can be evaded when transferring an NFT between different accounts.

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

You can find the full code example at [`case-2.js`](https://github.com/michielmulders/royalty-fee-test-cases/blob/main/case-2.js).

## Edge case 3

**Question:** What happens if no fungible value is exchanged in an NFT transfer and the receiver does not have the fixed fee fallback token but is associated with the fallback token?

**Output:** Fails with insufficient balance error for Bob (receiver) because he has 0 tokens: `INSUFFICIENT_SENDER_ACCOUNT_BALANCE_FOR_CUSTOM_FEE`. The same error is thrown when he has one or two tokens of this random token and the fallback fee is set to a higher amount than two.

```text
- Treasury balance: 5 NFTs of ID:0.0.48294326 and 5 ℏ
- Alice balance: undefined NFTs of ID:0.0.48294326 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48294326 and 30 ℏ

 NFT transfer Treasury->Alice status: SUCCESS 

- Treasury balance: 4 NFTs of ID:0.0.48294326 and 5 ℏ
- Alice balance: 1 NFTs of ID:0.0.48294326 and 30 ℏ
- Bob balance: 0 NFTs of ID:0.0.48294326 and 30 ℏ

ReceiptStatusError: receipt for transaction 0.0.47741098@1663679731.363621682 contained error status INSUFFICIENT_SENDER_ACCOUNT_BALANCE_FOR_CUSTOM_FEE
```

Here's a code snippet that shows the royalty fee definition. Bob's account will be associated with this random token.

```js
const randomTokenId = TokenId.fromString("0.0.48114789")
let nftCustomFee = new CustomRoyaltyFee()
    .setNumerator(5)
    .setDenominator(10)
    .setFeeCollectorAccountId(treasuryId)
    //the fallback to a random token
    .setFallbackFee(
        new CustomFixedFee()
        .setAmount(10)
        .setDenominatingTokenId(randomTokenId)
        .setFeeCollectorAccountId(treasuryId)
    );
```

You can find the full code example at [`case-3.js`](https://github.com/michielmulders/royalty-fee-test-cases/blob/main/case-3.js).

## Edge case 4

**Question:** What happens if no fungible value is exchanged in an NFT transfer and the buyer is not associated with the fixed fee fallback token?

**Output:** The transfer between Alice->Bob fails because Bob has to pay the fallback fee (no value exchanged) but he is not associated to the random token. Here, you get the expected `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT` error.

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

You can find the full code example at [`case-4.js`](https://github.com/michielmulders/royalty-fee-test-cases/blob/main/case-4.js).

## Edge case 5

**Question:** What happens when you create an NFT but the fee collector account is not associated with the fallback fee (CustomFixedFee)?

**Output:** The `TokenCreateTransaction` with the error: `TOKEN_NOT_ASSOCIATED_TO_FEE_COLLECTOR`.

You can find the full code example at [`case-5.js`](https://github.com/michielmulders/royalty-fee-test-cases/blob/main/case-5.js).

## Edge case 6

**Question:** What happens when you add a token as a custom royalty fee to an NFT and then delete this token on the ledger?

**Output:** As the docs for [deleting a token](https://docs.hedera.com/guides/docs/sdks/tokens/delete-a-token) mention, it will throw an error `TOKEN_WAS_DELETED` when transferring this NFT when no value is exchanged. 

It means that you can only exchange this NFT when transferring Hbar value. 

```text
 NFT transfer Treasury->Alice status: SUCCESS 

- Treasury balance: 5 ℏ NFTs of ID:0.0.48290163 4 and rand token: 980
- Alice balance: 20 ℏ NFTs of ID:0.0.48290163 1 and rand token: 10
- Bob balance: 20 ℏ NFTs of ID:0.0.48290163 0 and rand token: 10

- Token deleted

ReceiptStatusError: receipt for transaction 0.0.47741098@1663668783.262812175 contained error status TOKEN_WAS_DELETED
...
```

You can find the full code example at [`case-6.js`](https://github.com/michielmulders/royalty-fee-test-cases/blob/main/case-6.js).

## Edge case 7

**Question:** Can you update the royalty fee for NFTs to any number above 100%?

**Output:** This example first sets the royalty fee to 50% (5/10ths) and then updates the fee to 200% (200/100ths). However, the `TokenFeeScheduleUpdateTransaction` fails with the error `ROYALTY_FRACTION_CANNOT_EXCEED_ONE` which means that 100% is the maximum fee you can charge. 

```text
- Creating accounts...
- Created NFT with Token ID 0.0.2748981 and fee schedule 5/10ths

ReceiptStatusError: receipt for transaction 0.0.2617920@1675082562.837054051 contained error status ROYALTY_FRACTION_CANNOT_EXCEED_ONE
...
```

You can find the full code example at [`case-7.js`](https://github.com/michielmulders/royalty-fee-test-cases/blob/main/case-7.js).

## Edge case 8

**Question:** Can you steal funds from someone's account that has auto-association slots available by sending them an NFT with a fallback fee?

**Output:** No, stealing funds is impossible because the account receiving the NFT has to sign the fallback fee being withdrawn from their account's balance. Without the receiving user's signature, you'll get an INVALID_SIGNATURE error. 

```text
ReceiptStatusError: receipt for transaction 0.0.2617920@1687175554.994288926 contained error status INVALID_SIGNATURE
...
```

You can find the full code example at [`case-8.js`](https://github.com/michielmulders/royalty-fee-test-cases/blob/main/case-8.js).

# Check out the Code

Check out all code examples on [GitHub](https://github.com/michielmulders/royalty-fee-test-cases).

# Continue Learning

_If you want to learn more, check the [Hedera Token Service](https://docs.hedera.com/guides/docs/sdks/tokens) or [Custom Fees](https://docs.hedera.com/guides/docs/sdks/tokens/custom-token-fees) docs._