# Royalty Fee
**Definition:** Royalty fee charges a fraction of the value exchanged in a NFT transfer transaction. The fractional value is set by designating the numerator and denominator of the fraction.

**Fields:**
- numerator
- denumerator
- fallback fee(Fixed fee)
- fee collector account

**Docs:**
[Royalty Fee docs](https://docs.hedera.com/guides/docs/sdks/tokens/custom-token-fees#royalty-fee)

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
**What happens if there is no fungible value exchanged in a NFT transfer and the buyer does not have the fixed fee token?** (expected: fail)

**Output:**

Transfering the NFT from treasury->Alice succeeds because no custom fees are charged when transfering an NFT in/out the treasury account. Next, the transfer between Alice->Bob failsb because Bob has to pay the fallback fee (no value exchanged) but he is not associated to the random token. Error: `TOKEN_NOT_ASSOCIATED_TO_ACCOUNT`.

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

### Case 3
**What happens if there is an fungible token exchanged in a NFT transfer but the fee collector account is not associated with it?** (expected: fail)

[Docs: Dissociate tokens](https://docs.hedera.com/guides/docs/sdks/tokens/dissociate-tokens-from-an-account)

**Output:**

The code will fail when sending the `TokenCreateTransaction` with the error: `TOKEN_NOT_ASSOCIATED_TO_FEE_COLLECTOR`.


### Case 4
**What happens when you add a random token as custom royalty fee to an NFT and then delete this random token on the ledger?** (expected: fail)

[Docs: Delete token](https://docs.hedera.com/guides/docs/sdks/tokens/delete-a-token)

**Output:**

As the docs mention, it will throw an error `TOKEN_WAS_DELETED` when trying to transfer this NFT when no value is exchanged. So, it means that this NFT can only be exchanged now when transfering Hbar value. 

```text
 NFT transfer Treasury->Alice status: SUCCESS 

- Treasury balance: 5 ℏ NFTs of ID:0.0.48290163 4 and rand token: 980
- Alice balance: 20 ℏ NFTs of ID:0.0.48290163 1 and rand token: 10
- Bob balance: 20 ℏ NFTs of ID:0.0.48290163 0 and rand token: 10

- Random token deleted 

ReceiptStatusError: receipt for transaction 0.0.47741098@1663668783.262812175 contained error status TOKEN_WAS_DELETED
...
```