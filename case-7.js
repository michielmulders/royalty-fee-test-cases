console.clear();
require("dotenv").config();

const {
  Client,
  AccountId,
  TokenCreateTransaction,
  Hbar,
  TokenType,
  TokenSupplyType,
  PrivateKey,
  AccountCreateTransaction,
  TokenFeeScheduleUpdateTransaction,
  TokenInfoQuery,
  TokenMintTransaction,
  CustomRoyaltyFee,
  CustomFixedFee
} = require("@hashgraph/sdk");
require("dotenv").config();

// Configure accounts and client, and generate needed keys
const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);
const client = Client.forTestnet().setOperator(operatorId, operatorKey);
client.setDefaultMaxTransactionFee(new Hbar(100));

const feeScheduleKey = PrivateKey.generateED25519();

async function main() {
    console.log(`\n- Creating accounts...`);
    const initBalance = 10;
    const [feeScheduleAccStatus, feeScheduleId] = await accountCreatorFcn(
      feeScheduleKey,
      initBalance
    );

    // 50% royalty fee
    let nftCustomFee = new CustomRoyaltyFee()
        .setNumerator(5)
        .setDenominator(10)
        .setFeeCollectorAccountId(operatorId)
        //the fallback fee is set to 1 hbar.
        .setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(1)));

    let nftCreateTx = await new TokenCreateTransaction()
        .setTokenName("NFT Max Fee")
        .setTokenSymbol("NMF")
        .setTokenType(TokenType.NonFungibleUnique)
        .setDecimals(0)
        .setInitialSupply(0)
        .setTreasuryAccountId(operatorId)
        .setCustomFees([nftCustomFee])
        .setFeeScheduleKey(feeScheduleKey)
        .setSupplyType(TokenSupplyType.Finite)
        .setMaxSupply(10)
        .setSupplyKey(operatorKey) // not setting prevents anyone from minting/burning new NFTs (and we want to mint 1)
        .freezeWith(client);

  let nftCreateTxSign = await nftCreateTx.sign(operatorKey);
  let nftCreateSubmit = await nftCreateTxSign.execute(client);
  let nftCreateRx = await nftCreateSubmit.getReceipt(client);
  let tokenId = nftCreateRx.tokenId;

  // Log the token ID and custom fees
  console.log(`- Created NFT with Token ID ${tokenId} and fee schedule 5/10ths`);
  let tokenInfo = await new TokenInfoQuery()
    .setTokenId(tokenId)
    .execute(client);
  console.table(tokenInfo.customFees[0]);

  // Change fee schedule
  console.log(`- Change custom fee for NFT to 200%`);
  let newCustomFee = new CustomRoyaltyFee()
        .setNumerator(200)
        .setDenominator(100)
        .setFeeCollectorAccountId(operatorId)
        //the fallback fee is set to 1 hbar.
        .setFallbackFee(new CustomFixedFee().setHbarAmount(new Hbar(1)));
    
  const updateFeeScheduleTx = await new TokenFeeScheduleUpdateTransaction()
     .setTokenId(tokenId)
     .setCustomFees([newCustomFee])
     .freezeWith(client);

  const updateFeeScheduleTxSign = await updateFeeScheduleTx.sign(feeScheduleKey);
  const updateFeeScheduleTxSubmit = await updateFeeScheduleTxSign.execute(client);
  const updateFeeScheduleTxRx = await updateFeeScheduleTxSubmit.getReceipt(client);

  console.log(`Successful updated fee schedule, status: ${updateFeeScheduleTxRx.status.toString()}`)

  client.close();
  
  // ACCOUNT CREATOR FUNCTION ==========================================
  async function accountCreatorFcn(pvKey, iBal) {
    const response = await new AccountCreateTransaction()
      .setInitialBalance(new Hbar(iBal))
      .setKey(pvKey.publicKey)
      .execute(client);
    const receipt = await response.getReceipt(client);
    return [receipt.status, receipt.accountId];
  }
}

main();
