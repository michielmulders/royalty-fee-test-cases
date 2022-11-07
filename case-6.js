const {
  Client,
  PrivateKey,
  AccountId,
  AccountCreateTransaction,
  AccountBalanceQuery,
  CustomFixedFee,
  TokenCreateTransaction,
  TokenType,
  TransferTransaction,
  TokenAssociateTransaction,
  Hbar,
  TokenId,
  CustomRoyaltyFee,
  TokenSupplyType,
  AccountUpdateTransaction,
  TokenInfoQuery,
  TokenMintTransaction,
  TokenDeleteTransaction
} = require("@hashgraph/sdk");
require("dotenv").config();

// Transfering a token with custom fee schedules set fails with a token not associated to account error because Alice and Bob are not associated to the token.
// When adding the association for Alice and Bob to this new random token, it fails with INSUFFICIENT_SENDER_ACCOUNT_BALANCE_FOR_CUSTOM_FEE which makes sense because they didn't receive the token

async function main() {
  const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
  const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);
  const supplyKey = PrivateKey.generateED25519();
  const adminKey = PrivateKey.generateED25519();

  // If we weren't able to grab it, we should throw a new error
  if (operatorId == null || operatorKey == null) {
    throw new Error(
      "Environment variables operatorId and operatorKey must be present"
    );
  }

  const client = Client.forTestnet().setOperator(operatorId, operatorKey);
  client.setDefaultMaxTransactionFee(new Hbar(100));

  // Create accounts
  const initBalance = 20;
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
  const [bobAccStatus, bobId] = await accountCreatorFcn(bobKey, initBalance);
  console.log(
    `- Created bob's account ${bobId} that has a balance of ${initBalance} ℏ`
  );

  // Create random token for treasury account
  const randomTokenCreateTx = await new TokenCreateTransaction()
    .setTokenName("USDRandom")
    .setTokenSymbol("RAND")
    .setDecimals(1)
    .setInitialSupply(1000) // 100 tokens
    .setTokenType(TokenType.FungibleCommon)
    .setTreasuryAccountId(treasuryId)
    .setAdminKey(treasuryKey) // need to set this otherwise token is immutable and can't be deleted
    .freezeWith(client)
    .sign(treasuryKey);

  const randomTokenCreateSubmit = await randomTokenCreateTx.execute(client);
  const randomTokenCreateRx = await randomTokenCreateSubmit.getReceipt(client);
  console.log(
    "Status of random token: ",
    randomTokenCreateRx.status.toString()
  );
  const randomTokenId = randomTokenCreateRx.tokenId;

  // Associate accounts Alice and Bob
  const associateTxAliceRandomToken = await new TokenAssociateTransaction()
    .setAccountId(aliceId)
    .setTokenIds([randomTokenId])
    .freezeWith(client)
    .sign(aliceKey);
  await associateTxAliceRandomToken.execute(client);

  const associateTxBobRandomToken = await new TokenAssociateTransaction()
    .setAccountId(bobId)
    .setTokenIds([randomTokenId])
    .freezeWith(client)
    .sign(bobKey);
  await associateTxBobRandomToken.execute(client);

  // Transfer some of this random token to Alice and Bob
  const tokenTransferTxRandom = await new TransferTransaction()
    .addTokenTransfer(randomTokenId, treasuryId, -20)
    .addTokenTransfer(randomTokenId, aliceId, 10)
    .addTokenTransfer(randomTokenId, bobId, 10)
    .freezeWith(client)
    .sign(treasuryKey);

  const tokenTransferTxRandomSubmit = await tokenTransferTxRandom.execute(
    client
  );
  const tokenTransferRxRandom = await tokenTransferTxRandomSubmit.getReceipt(
    client
  );
  console.log(
    "Transfer random token treasury->Alice and treasury->Bob ",
    tokenTransferRxRandom.status.toString()
  );

  // Create royalty fee
  let nftCustomFee = new CustomRoyaltyFee()
    .setNumerator(5)
    .setDenominator(10) // 50%
    .setFeeCollectorAccountId(treasuryId)
    //the fallback to random token
    .setFallbackFee(
      new CustomFixedFee()
        .setAmount(5)
        .setDenominatingTokenId(randomTokenId)
        .setFeeCollectorAccountId(treasuryId)
    );

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
    `- Treasury balance: ${oB[0]} NFTs of ID:${tokenId} ${oB[1]} and rand token: ${oB[2]}`
  );
  console.log(`- Alice balance: ${aB[0]} NFTs of ID:${tokenId} ${aB[1]} and rand token: ${aB[2]}`);
  console.log(`- Bob balance: ${bB[0]} NFTs of ID:${tokenId} ${bB[1]} and rand token: ${bB[2]}`);

  // DELETE RANDOM TOKEN FROM TREASURY
  let tokenDeleteTx = await new TokenDeleteTransaction()
    .setTokenId(randomTokenId)
    .freezeWith(client)
    .sign(treasuryKey);
  await tokenDeleteTx.execute(client);
  console.log(`\n- Random token deleted \n`)

  // 2nd NFT TRANSFER NFT Alice->Bob (no value transfered)
  let tokenTransferTx2 = await new TransferTransaction()
    .addNftTransfer(tokenId, 2, aliceId, bobId)
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
    `- Treasury balance: ${oB[0]} NFTs of ID:${tokenId} ${oB[1]} and rand token: ${oB[2]}`
  );
  console.log(`- Alice balance: ${aB[0]} NFTs of ID:${tokenId} ${aB[1]} and rand token: ${aB[2]}`);
  console.log(`- Bob balance: ${bB[0]} NFTs of ID:${tokenId} ${bB[1]} and rand token: ${bB[2]}`);

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

  // ACCOUNT CREATOR FUNCTION ==========================================
  async function accountCreatorFcn(pvKey, iBal) {
    const response = await new AccountCreateTransaction()
      .setInitialBalance(new Hbar(iBal))
      .setKey(pvKey.publicKey)
      .execute(client);
    const receipt = await response.getReceipt(client);
    return [receipt.status, receipt.accountId];
  }

  async function bCheckerFcn(accountId) {
    let balanceCheckTx = await new AccountBalanceQuery()
      .setAccountId(accountId)
      .execute(client);
      // balance.tokens will be deprecated from November mainnet release (use mirror node)
      // https://hedera.com/blog/token-information-returned-by-getaccountinfo-and-getaccountbalance-to-be-deprecated
    return [
      balanceCheckTx.hbars.toString(),
      balanceCheckTx.tokens._map.get(tokenId.toString())?.low,
      balanceCheckTx.tokens._map.get(randomTokenId.toString())?.low,
    ];
  }
}

main();
