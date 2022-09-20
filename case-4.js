console.clear();
require("dotenv").config();

const {
  AccountId,
  PrivateKey,
  Client,
  TokenCreateTransaction,
  TokenInfoQuery,
  TokenType,
  CustomRoyaltyFee,
  CustomFixedFee,
  Hbar,
  TokenSupplyType,
  TokenMintTransaction,
  TokenBurnTransaction,
  TransferTransaction,
  AccountBalanceQuery,
  AccountUpdateTransaction,
  TokenAssociateTransaction,
  TokenId,
  TokenNftInfoQuery,
  NftId,
  AccountCreateTransaction,
} = require("@hashgraph/sdk");

// Configure accounts and client, and generate needed keys
const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);
const client = Client.forTestnet().setOperator(operatorId, operatorKey);
client.setDefaultMaxTransactionFee(new Hbar(100));

const supplyKey = PrivateKey.generateED25519();
const adminKey = PrivateKey.generateED25519();

async function main() {
  console.log(`\n- Creating accounts...`);
  const initBalance = 30;
  const treasuryKey = PrivateKey.generateED25519();
  const [treasuryAccStatus, treasuryId] = await accountCreatorFcn(
    treasuryKey,
    5
  );
  console.log(
    `- Created Treasury account ${treasuryId} that has a balance of ${initBalance} ℏ`
  );

  const aliceKey = PrivateKey.generateED25519();
  const [aliceAccStatus, aliceId] = await accountCreatorFcn(
    aliceKey,
    initBalance
  );
  console.log(
    `- Created Alice's account ${aliceId} that has a balance of ${initBalance} ℏ`
  );

  const bobKey = PrivateKey.generateED25519();
  const [bobAccSt, bobId] = await accountCreatorFcn(bobKey, initBalance);
  console.log(
    `- Created bob's account ${bobId} that has a balance of ${initBalance} ℏ`
  );

  // DEFINE CUSTOM FEE SCHEDULE (50% royalty fee - 5/10ths)
  const randomTokenId = TokenId.fromString("0.0.48114789")
  let nftCustomFee = new CustomRoyaltyFee()
    .setNumerator(5)
    .setDenominator(10)
    .setFeeCollectorAccountId(treasuryId)
    //the fallback to random token
    .setFallbackFee(
      new CustomFixedFee()
        .setAmount(10)
        .setDenominatingTokenId(randomTokenId)
        .setFeeCollectorAccountId(treasuryId)
    );

  // ASSOCIATE TREASURY ACCOUNT TO RANDOM TOKEN (commented out for this test case)
  /*
  const associateTxTreasury = await new TokenAssociateTransaction()
    .setAccountId(treasuryId)
    .setTokenIds([randomTokenId])
    .freezeWith(client)
    .sign(treasuryKey);
  await associateTxTreasury.execute(client);
  console.log(`Random token associated to treasury account \n`)
  */

  // IPFS CONTENT IDENTIFIERS FOR WHICH WE WILL CREATE NFTs
  let CID = [
    "QmNPCiNA3Dsu3K5FxDPMG5Q3fZRwVTg14EXA92uqEeSRXn",
    "QmZ4dgAgt8owvnULxnKxNe8YqpavtVCXmc1Lt2XajFpJs9",
    "QmPzY5GxevjyfMUF5vEAjtyRoigzWp47MiKAtLBduLMC1T",
    "Qmd3kGgSrAwwSrhesYcY7K54f3qD7MDo38r7Po2dChtQx5",
    "QmWgkKz3ozgqtnvbCLeh7EaR1H8u5Sshx3ZJzxkcrT3jbw",
  ];

  // CREATE NFT WITH CUSTOM FEE
  let nftCreate = await new TokenCreateTransaction()
    .setTokenName("Fall Collection")
    .setTokenSymbol("LEAF")
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(treasuryId)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(CID.length)
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

  // TOKEN QUERY TO CHECK THAT THE CUSTOM FEE SCHEDULE IS ASSOCIATED WITH NFT
  let tokenInfo = await new TokenInfoQuery()
    .setTokenId(tokenId)
    .execute(client);
  console.table(tokenInfo.customFees[0]);

  // MINT NEW BATCH OF NFTs
  let nftLeaf = [];
  for (var i = 0; i < CID.length; i++) {
    nftLeaf[i] = await tokenMinterFcn(CID[i]);
    console.log(
      `Created NFT ${tokenId} with serial: ${nftLeaf[i].serials[0].low}`
    );
  }

  tokenInfo = await new TokenInfoQuery().setTokenId(tokenId).execute(client);
  console.log(`Current NFT supply: ${tokenInfo.totalSupply} \n`);

  // AUTO-ASSOCIATION FOR ALICE'S ACCOUNT
  let associateTx = await new AccountUpdateTransaction()
    .setAccountId(aliceId)
    .setMaxAutomaticTokenAssociations(100)
    .freezeWith(client)
    .sign(aliceKey);
  let associateTxSubmit = await associateTx.execute(client);
  let associateRx = await associateTxSubmit.getReceipt(client);
  console.log(`Alice NFT Auto-Association: ${associateRx.status} \n`);

  // MANUAL ASSOCIATION FOR BOB'S ACCOUNT
  let associateBobTx = await new TokenAssociateTransaction()
    .setAccountId(bobId)
    .setTokenIds([tokenId])
    .freezeWith(client)
    .sign(bobKey);
  let associateBobTxSubmit = await associateBobTx.execute(client);
  let associateBobRx = await associateBobTxSubmit.getReceipt(client);
  console.log(`Bob NFT Manual Association: ${associateBobRx.status} \n`);

  // BALANCE CHECK 1
  let oB = await bCheckerFcn(treasuryId);
  let aB = await bCheckerFcn(aliceId);
  let bB = await bCheckerFcn(bobId);
  console.log(
    `- Treasury balance: ${oB[0]} NFTs of ID:${tokenId} and ${oB[1]}`
  );
  console.log(`- Alice balance: ${aB[0]} NFTs of ID:${tokenId} and ${aB[1]}`);
  console.log(`- Bob balance: ${bB[0]} NFTs of ID:${tokenId} and ${bB[1]}`);

  // 1st TRANSFER NFT Treasury->Alice
  let tokenTransferTx = await new TransferTransaction()
    .addNftTransfer(tokenId, 2, treasuryId, aliceId)
    .freezeWith(client)
    .sign(treasuryKey);
  // A token's treasury account is exempt from paying any custom transaction fees when the token is transferred.
  let tokenTransferSubmit = await tokenTransferTx.execute(client);
  let tokenTransferRx = await tokenTransferSubmit.getReceipt(client);
  console.log(
    `\n NFT transfer Treasury->Alice status: ${tokenTransferRx.status} \n`
  );

  // BALANCE CHECK 2
  oB = await bCheckerFcn(treasuryId);
  aB = await bCheckerFcn(aliceId);
  bB = await bCheckerFcn(bobId);
  console.log(
    `- Treasury balance: ${oB[0]} NFTs of ID:${tokenId} and ${oB[1]}`
  );
  console.log(`- Alice balance: ${aB[0]} NFTs of ID:${tokenId} and ${aB[1]}`);
  console.log(`- Bob balance: ${bB[0]} NFTs of ID:${tokenId} and ${bB[1]}`);

  // 2nd NFT TRANSFER NFT Alice->Bob
  let tokenTransferTx2 = await new TransferTransaction()
    .addNftTransfer(tokenId, 2, aliceId, bobId)
    // CHANGE FOR DIFFERENT OUTCOME BElOW
    //if lines "addHbarTransfer" are commented out, the fallback fee will be used since no fungible token was transfered with the NFT
    // .addHbarTransfer(aliceId, 10) // Alice only receives 5 and 50% (5/10) goes to the treasury account because of the custom fee
    // .addHbarTransfer(bobId, -10)
    .freezeWith(client)
    .sign(aliceKey); // Regular fee is paid by the operator ID
  tokenTransferTx2Sign = await tokenTransferTx2.sign(bobKey); // Bob has to sign because he has to pay fallback fee
  let tokenTransferSubmit2 = await tokenTransferTx2Sign.execute(client);
  let tokenTransferRx2 = await tokenTransferSubmit2.getReceipt(client);
  console.log(
    `\n NFT transfer Alice->Bob status: ${tokenTransferRx2.status} \n`
  );

  // BALANCE CHECK 3
  oB = await bCheckerFcn(treasuryId);
  aB = await bCheckerFcn(aliceId);
  bB = await bCheckerFcn(bobId);
  console.log(
    `- Treasury balance: ${oB[0]} NFTs of ID:${tokenId} and ${oB[1]}`
  );
  console.log(`- Alice balance: ${aB[0]} NFTs of ID:${tokenId} and ${aB[1]}`);
  console.log(`- Bob balance: ${bB[0]} NFTs of ID:${tokenId} and ${bB[1]}`);

  client.close();

  // TOKEN MINTER FUNCTION ==========================================
  async function tokenMinterFcn(CID) {
    mintTx = await new TokenMintTransaction()
      .setTokenId(tokenId)
      .setMetadata([Buffer.from(CID)])
      .freezeWith(client);
    let mintTxSign = await mintTx.sign(supplyKey);
    let mintTxSubmit = await mintTxSign.execute(client);
    let mintRx = await mintTxSubmit.getReceipt(client);
    return mintRx;
  }

  // BALANCE CHECKER FUNCTION ==========================================
  async function bCheckerFcn(id) {
    balanceCheckTx = await new AccountBalanceQuery()
      .setAccountId(id)
      .execute(client);
    return [
      balanceCheckTx.tokens._map.get(tokenId.toString()),
      balanceCheckTx.hbars,
    ];
  }

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
