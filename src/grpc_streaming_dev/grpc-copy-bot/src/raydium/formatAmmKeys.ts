import {
    LIQUIDITY_STATE_LAYOUT_V4,
    MARKET_STATE_LAYOUT_V3,
    SPL_MINT_LAYOUT,
    Liquidity,
    Market,
    MAINNET_PROGRAM_ID,
    LiquidityStateV4,
    publicKey,
    struct,
  }  from "@raydium-io/raydium-sdk";
  import  { PublicKey } from "@solana/web3.js";
  const MINIMAL_MARKET_STATE_LAYOUT_V3 = struct([
    publicKey("eventQueue"),
    publicKey("bids"),
    publicKey("asks"),
  ]);
  import { connection } from "../constants";
  
  // Promise<ApiPoolInfoV4>
  /**
   * Formats AMM keys by ID.
   * @param {string} id - The ID of the AMM.
   * @returns {Object} - The formatted AMM keys.
   * @throws {Error} - If there is an error retrieving the account information.
   */
export async function formatAmmKeysById_swap(id: PublicKey):Promise<any> {
    const account = await connection.getAccountInfo(id);
    if (account === null) throw Error(" get id info error ");
    const info = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data);
  
    const marketId = info.marketId;
    const marketAccount_minimal = await connection.getAccountInfo(marketId, {
      commitment: "processed",
      dataSlice: {
        offset: MARKET_STATE_LAYOUT_V3.offsetOf("eventQueue"),
        length: 32 * 3,
      },
    });
    const marketAccount = await connection.getAccountInfo(marketId);
    if (marketAccount === null || marketAccount_minimal === null)
      throw Error(" get market info error");
    const marketInfo_minimal = MINIMAL_MARKET_STATE_LAYOUT_V3.decode(
      marketAccount_minimal.data
    );
    const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);
  
    return {
      id,
      baseMint: info.baseMint,
      quoteMint: info.quoteMint,
      lpMint: info.lpMint,
      baseDecimals: info.baseDecimal.toNumber(),
      quoteDecimals: info.quoteDecimal.toNumber(),
      lpDecimals: 5,
      version: 4,
      programId: MAINNET_PROGRAM_ID.AmmV4,
      authority: Liquidity.getAssociatedAuthority({
        programId: MAINNET_PROGRAM_ID.AmmV4,
      }).publicKey,
      openOrders: info.openOrders,
      targetOrders: info.targetOrders,
      baseVault: info.baseVault,
      quoteVault: info.quoteVault,
      marketVersion: 3,
      marketProgramId: info.marketProgramId,
      marketId: info.marketId,
      marketAuthority: Market.getAssociatedAuthority({
        programId: info.marketProgramId,
        marketId: info.marketId,
      }).publicKey,
      marketBaseVault: marketInfo.baseVault,
      marketQuoteVault: marketInfo.quoteVault,
      marketBids: marketInfo_minimal.bids,
      marketAsks: marketInfo_minimal.asks,
      marketEventQueue: marketInfo_minimal.eventQueue,
      withdrawQueue: info.withdrawQueue,
      lpVault: info.lpVault,
      lookupTableAccount: PublicKey.default,
    };
  }
  