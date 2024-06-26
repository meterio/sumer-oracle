import { Contract } from "ethers";
import { ethers } from "hardhat";

export interface Feed {
  [key: string]: string;
}

export interface Config {
  [key: string]: Feed;
}

export interface Asset {
  token: string;
  address: string;
  oracle: string;
  price?: string;
  stalePeriod?: number;
  twapDuration?: number;
  denominatedBy?: string;
}

export interface Assets {
  [key: string]: Asset[];
}

export interface NetworkAddress {
  [key: string]: string;
}

export interface PreconfiguredAddresses {
  [key: string]: NetworkAddress;
}

export interface AccessControlEntry {
  caller: string;
  target: string;
  method: string;
}

export interface Oracle {
  oracles: [string, string, string];
  enableFlagsForOracles: [boolean, boolean, boolean];
  underlyingOracle: Contract;
  getTokenConfig?: (asset: Asset, networkName: string) => void;
  getDirectPriceConfig?: (asset: Asset) => void;
  getStalePeriodConfig?: (asset: Asset) => string[];
}

export interface Oracles {
  [key: string]: Oracle;
}

export const SEQUENCER: Record<string, string> = {
  arbitrum: "0xFdB631F5EE196F0ed6FAa767959853A9F217697D",
};

export const addr0000 = "0x0000000000000000000000000000000000000000";
export const DEFAULT_STALE_PERIOD = 24 * 60 * 60; // 24 hrs
export const DEFAULT_TWAP_DURATION = 30 * 60; // 30min
const STALE_PERIOD_100M = 60 * 100; // 100 minutes (for pricefeeds with heartbeat of 1 hr)
const STALE_PERIOD_26H = 60 * 60 * 26; // 26 hours (pricefeeds with heartbeat of 24 hr)
export const ANY_CONTRACT = ethers.constants.AddressZero;

export const ADDRESSES: PreconfiguredAddresses = {
  metertest: {
    nativeMarket: ethers.constants.AddressZero,
    nativeAsset: "",
    VAIAddress: ethers.constants.AddressZero,
    acm: "0xcB5f549cF00C342Bc3BA74db2d90d4554dd3De0b", // FIXME:
    timelock: "0x14b27D8DC12E59a9904DaC6d17D33B8de2E80e66", // FIXME: Meter Testnet Multisig

    pythOracleAddress: "0x5a71C07a0588074443545eE0c08fb0375564c3E4",
  },
  metermain: {
    nativeMarket: ethers.constants.AddressZero,
    nativeAsset: "",
    VAIAddress: ethers.constants.AddressZero,
    acm: "", // FIXME:
    timelock: "", // FIXME: Meter Mainnet Multisig

    pythOracleAddress: "0xbfe3f445653f2136b2fd1e6dddb5676392e3af16",
  },
  sepolia: {
    nativeMarket: ethers.constants.AddressZero, // sdrETH
    nativeAsset: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", // WETH
    VAIAddress: ethers.constants.AddressZero,
    acm: "0xbcbda48712A075fa7B50b4B6f8C42D40D4505F8B",
    timelock: "0x14b27D8DC12E59a9904DaC6d17D33B8de2E80e66", // FIXME: Sepolia Multisig

    weETH: "0x3b8b6E96e57f0d1cD366AaCf4CcC68413aF308D0",
    eETH: "0x0012875a7395a293Adfc9b5cDC2Cfa352C4cDcD3",
    WETH: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    ptOracle: "0x28A59851C1CB12351D7c6aEf98FFE2871d7cF898",
  },
  ethereum: {
    nativeMarket: "", // FIXME: replace this with correct address
    nativeAsset: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    VAIAddress: ethers.constants.AddressZero,
    acm: ethers.constants.AddressZero, // FIXME: replace this with correct address
    timelock: "", // FIXME: Ethereum Multisig

    weETH: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
    eETH: "0x35fA164735182de50811E8e2E824cFb9B6118ac2",
    ptOracle: "0x9a9fa8338dd5e5b2188006f1cd2ef26d921650c2",
    EtherFiLiquidityPool: "0x308861A430be4cce5502d0A12724771Fc6DaF216",
    WETH: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  },
  arbitrum: {
    nativeMarket: "0x3C752d0D78BbFddA6BF4b6000a01228B732441aE", // sdrETH
    nativeAsset: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", // WETH
    VAIAddress: ethers.constants.AddressZero,
    acm: "", // FIXME: replace this with correct address
    timelock: "", // FIXME: Arbitrum One Multisig

    weETH: "0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe",
    ptOracle: "0x9a9fa8338dd5e5b2188006f1cd2ef26d92165",
  },
  base: {
    nativeMarket: ethers.constants.AddressZero,
    nativeAsset: "",
    VAIAddress: ethers.constants.AddressZero,
    acm: "", // FIXME: replace this with correct address
    timelock: "", // FIXME: Arbitrum One Multisig

    weETH: "0x04C0599Ae5A44757c0af6F9eC3b93da8976c150A",
  },
};

export const chainlinkFeed: Config = {
  metertest: {},
  metermain: {},
  sepolia: {
    WBTC: "0x1b44F3514812d835EB1BDB0acB33d3fA3351Ee43",
    WETH: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    USDC: "0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E",
  },
  ethereum: {
    WBTC: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c",
    WETH: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    USDT: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
    USDC: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
    "weETH/WETH": "0x5c9C449BbC9a6075A2c061dF312a35fd1E05fF22", // denominated by ETH
  },
  arbitrum: {
    USDC: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3",
    USDT: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7",
    WBTC: "0x6ce185860a4963106506C203335A2910413708e9",
    ARB: "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6",
    WETH: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    DAI: "0xc5C8E77B397E531B8EC06BFb0048328B30E9eCfB",
    suETH: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612",
    suBTC: "0x6ce185860a4963106506C203335A2910413708e9",
    "RETH/WETH": "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9", // denomicated by ETH
    "wstETH/WETH": "0xb523AE262D20A936BC152e6023996e46FDC2A95D", // denominated by ETH
    "weETH/WETH": "0x5c9C449BbC9a6075A2c061dF312a35fd1E05fF22", // denominated by ETH
  },
  base: {
    "weETH/WETH": "0xFC1415403EbB0c693f9a7844b92aD2Ff24775C65", // denominated by ETH
  },
};

export const redstoneFeed: Config = {
  sepolia: {},
  ethereum: {
    "weETH/WETH": "0x8751F736E94F6CD167e8C5B97E245680FbD9CC36", // denominated by ETH
    "pufETH/WETH": "0x76A495b0bFfb53ef3F0E94ef0763e03cE410835C", // denominated by ETH
    USDe: "0xbC5FBcf58CeAEa19D523aBc76515b9AEFb5cfd58",
    sUSDe: "0xb99D174ED06c83588Af997c8859F93E83dD4733f",
  },
  arbitrum: {
    "weETH/WETH": "0xA736eAe8805dDeFFba40cAB8c99bCB309dEaBd9B", // denominated by ETH
  },
};

export const pythID: Config = {
  metertest: {
    WBTC: "0xc9d8b075a5c69303365ae23633d4e085199bf5c520a3b90fed1322a0342ffc33",
    BTC: "0xc9d8b075a5c69303365ae23633d4e085199bf5c520a3b90fed1322a0342ffc33",
    USDT: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
    USDC: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    ETH: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    MTR: "0x8cdc9b2118d2ce55a299f8f1d700d0127cf4036d1aa666a8cd51dcab4254284f",
    MTRG: "0x20d096e088a9b85f8cf09278965b77aeb05c00769e2ddeda5ea2d07ea554b283",
  },
  metermain: {
    WBTC: "c9d8b075a5c69303365ae23633d4e085199bf5c520a3b90fed1322a0342ffc33",
    BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    USDT: "2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
    USDC: "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
    ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    MTR: "8cdc9b2118d2ce55a299f8f1d700d0127cf4036d1aa666a8cd51dcab4254284f",
    MTRG: "20d096e088a9b85f8cf09278965b77aeb05c00769e2ddeda5ea2d07ea554b283",
  },
};

export const pendleMarket: Config = {
  sepolia: { PTweETH_26DEC2024: "0xB1bE063Ccbc4f67f58293C402aF8D082c0459787" },
  ethereum: { PTweETH_26DEC2024: "0x7d372819240d14fb477f17b964f95f33beb4c704" },
  arbitrum: { PTweETH_25SEP2024: "0xf9f9779d8ff604732eba9ad345e6a27ef5c2a9d6" },
  metertest: {},
};

export const assets: Assets = {
  metertest: [
    { token: "USDC", address: "0x2b27f5f7f2867ad9d2b7065f81e985c1bd1b7274", oracle: "pyth" },
    { token: "USDT", address: "0x2398633bee182cad2d0388b41735fd9fb742098d", oracle: "pyth" },
    { token: "ETH", address: "0xe8876830e7cc85dae8ce31b0802313caf856886f", oracle: "pyth" },
    { token: "BTC", address: "0x7EB9e0Df1C6E6f1E9d3d1EdA09fcF688FE7A710c", oracle: "pyth" },
    { token: "MTRG", address: "0x8a419ef4941355476cf04933e90bf3bbf2f73814", oracle: "pyth" },
    // { token: "MTR", address: "0x0000000000000000000000000000000000000000", oracle: "pyth" },
  ],
  sepolia: [
    { token: "WBTC", address: "0x92A2928f5634BEa89A195e7BeCF0f0FEEDAB885b", oracle: "chainlink" },
    { token: "WETH", address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", oracle: "chainlink" },
    { token: "USDC", address: "0x772d68929655ce7234C8C94256526ddA66Ef641E", oracle: "chainlink" },
    {
      token: "USDT",
      address: "0x8d412FD0bc5d826615065B931171Eed10F5AF266",
      oracle: "chainlinkFixed",
      price: "1000000000000000000",
    },
    {
      token: "weETH",
      address: "0x3b8b6E96e57f0d1cD366AaCf4CcC68413aF308D0",
      oracle: "chainlinkFixed",
      price: "1040000000000000000",
      denominatedBy: "WETH",
    }, // denominated by ETH
    {
      token: "PTweETH_26DEC2024",
      address: "0x0F0747Fe5a6B68C1149AeD0A437905b06b77b9Cb",
      oracle: "pendle",
      twapDuration: 1800,
    },
  ],
  ethereum: [
    {
      token: "WBTC",
      address: "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
      oracle: "chainlink",
      stalePeriod: STALE_PERIOD_100M,
    },
    {
      token: "WETH",
      address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
      oracle: "chainlink",
      stalePeriod: STALE_PERIOD_100M,
    },
    {
      token: "USDC",
      address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      oracle: "chainlink",
      stalePeriod: STALE_PERIOD_26H,
    },
    {
      token: "USDT",
      address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
      oracle: "chainlink",
      stalePeriod: STALE_PERIOD_26H,
    },
    {
      token: "PTweETH_26DEC2024",
      address: "0x6ee2b5e19ecba773a352e5b21415dc419a700d1d",
      oracle: "pendle",
      twapDuration: 1800,
    },
  ],
  arbitrum: [
    { token: "WBTC", address: "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f", oracle: "chainlink" },
    { token: "USDC", address: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", oracle: "chainlink" },
    { token: "USDT", address: "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", oracle: "chainlink" },
    { token: "ARB", address: "0x912ce59144191c1204e64559fe8253a0e49e6548", oracle: "chainlink" },
    { token: "WETH", address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1", oracle: "chainlink" },
    {
      token: "weETH",
      address: "0xCd5fE23C85820F7B72D0926FC9b05b43E359b7ee",
      oracle: "chainlink",
      denominatedBy: "WETH",
    },
    { token: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", oracle: "chainlink" },
    {
      token: "RETH",
      address: "0xec70dcb4a1efa46b8f2d97c310c9c4790ba5ffa8",
      oracle: "chainlink",
      denominatedBy: "WETH",
    },
    {
      token: "wstETH",
      address: "0x5979D7b546E38E414F7E9822514be443A4800529",
      oracle: "chainlink",
      denominatedBy: "WETH",
    },
    {
      token: "PTweETH_25SEP2024",
      address: "0xb8b0a120f6a68dd06209619f62429fb1a8e92fec",
      oracle: "pendle",
      twapDuration: 1800,
    },
  ],
};

export const getOraclesData = async (): Promise<Oracles> => {
  const chainlinkOracle = await ethers.getContractOrNull("ChainlinkOracle");
  const redstoneOracle = await ethers.getContractOrNull("RedStoneOracle");
  const binanceOracle = await ethers.getContractOrNull("BinanceOracle");
  const pythOracle = await ethers.getContractOrNull("PythOracle");
  const pendleOracle = await ethers.getContractOrNull("PendleOracle");

  const oraclesData: Oracles = {
    ...(chainlinkOracle
      ? {
          chainlink: {
            oracles: [chainlinkOracle.address, addr0000, addr0000],
            enableFlagsForOracles: [true, false, false],
            underlyingOracle: chainlinkOracle,
            getTokenConfig: (asset: Asset, name: string) => {
              let feedName = asset.token;
              if (asset.denominatedBy) {
                feedName = `${asset.token}/${asset.denominatedBy}`;
              }
              return {
                asset: asset.address,
                feed: chainlinkFeed[name][feedName],
                maxStalePeriod: asset.stalePeriod ? asset.stalePeriod : DEFAULT_STALE_PERIOD,
              };
            },
          },
          chainlinkFixed: {
            oracles: [chainlinkOracle.address, addr0000, addr0000],
            enableFlagsForOracles: [true, false, false],
            underlyingOracle: chainlinkOracle,
            getDirectPriceConfig: (asset: Asset) => ({
              asset: asset.address,
              price: asset.price,
            }),
          },
        }
      : {}),
    ...(redstoneOracle
      ? {
          redstone: {
            oracles: [redstoneOracle.address, addr0000, addr0000],
            enableFlagsForOracles: [true, false, false],
            underlyingOracle: redstoneOracle,
            getTokenConfig: (asset: Asset, name: string) => {
              let feedName = asset.token;
              if (asset.denominatedBy) {
                feedName = `${asset.token}/${asset.denominatedBy}`;
              }
              return {
                asset: asset.address,
                feed: redstoneFeed[name][feedName],
                maxStalePeriod: asset.stalePeriod ? asset.stalePeriod : DEFAULT_STALE_PERIOD,
              };
            },
          },
        }
      : {}),
    ...(binanceOracle
      ? {
          binance: {
            oracles: [binanceOracle.address, addr0000, addr0000],
            enableFlagsForOracles: [true, false, false],
            underlyingOracle: binanceOracle,
            getStalePeriodConfig: (asset: Asset) => [
              asset.token,
              asset.stalePeriod ? asset.stalePeriod.toString() : DEFAULT_STALE_PERIOD.toString(),
            ],
          },
        }
      : {}),
    ...(pythOracle
      ? {
          pyth: {
            oracles: [pythOracle.address, addr0000, addr0000],
            enableFlagsForOracles: [true, false, false],
            underlyingOracle: pythOracle,
            getTokenConfig: (asset: Asset, name: string) => ({
              pythId: pythID[name][asset.token],
              asset: asset.address,
              maxStalePeriod: asset.stalePeriod ? asset.stalePeriod : DEFAULT_STALE_PERIOD,
            }),
          },
        }
      : {}),
    ...(pendleOracle
      ? {
          pendle: {
            oracles: [pendleOracle.address, addr0000, addr0000],
            enableFlagsForOracles: [true, false, false],
            underlyingOracle: pendleOracle,
            getTokenConfig: (asset: Asset, name: string) => ({
              market: pendleMarket[name][asset.token],
              asset: asset.address,
              twapDuration: asset.twapDuration ? asset.twapDuration : DEFAULT_TWAP_DURATION,
            }),
          },
        }
      : {}),
  };

  return oraclesData;
};

export const getOraclesToDeploy = async (network: string): Promise<Record<string, boolean>> => {
  const oracles: Record<string, boolean> = {};

  assets[network].forEach(asset => {
    oracles[asset.oracle] = true;
  });

  return oracles;
};
