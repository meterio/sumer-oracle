import { Contract } from "ethers";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { Asset, DEFAULT_STALE_PERIOD, assets, chainlinkFeed, redstoneFeed } from "../helpers/deploymentConfig";

const configurePriceFeeds = async (
  hre: HardhatRuntimeEnvironment,
  oracle: Contract,
  oracleName: string,
  oracleFeeds: { [key: string]: string },
): Promise<void> => {
  const networkName = hre.network.name;
  const assetMap: { [key: string]: Asset } = {};
  for (const asset of assets[networkName]) {
    assetMap[asset.token] = asset;
  }

  for (const feedName in oracleFeeds) {
    let asset: Asset;
    const feedAddr = oracleFeeds[feedName];
    if (feedName.includes("/")) {
      asset = assetMap[feedName.split("/")[0]];
    } else {
      asset = assetMap[feedName];
    }
    const maxStalePeriod = asset.stalePeriod || DEFAULT_STALE_PERIOD;

    if (!asset) {
      console.log(`[WARN] ${oracleName} feed ${feedName} doesn't have corresponding asset ${asset}`);
    } else {
      const configOnChain = await oracle.tokenConfigs(asset.address);
      if (
        configOnChain.asset.toLowerCase() !== asset.address.toLowerCase() ||
        configOnChain.feed !== feedAddr ||
        configOnChain.maxStalePeriod.toNumber() !== maxStalePeriod
      ) {
        console.log(
          `Config ${asset.token} on ${oracleName} oracle with ${JSON.stringify({
            asset: asset.address,
            feed: feedAddr,
            maxStalePeriod,
          })}`,
        );

        await (await oracle.setTokenConfig([asset.address, feedAddr, maxStalePeriod])).wait(1);
      } else {
        console.log(`Checked ${asset.token} settings on ${oracleName} oracle`);
      }
    }
  }
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const networkName = hre.network.name;
  const assetMap: { [key: string]: Asset } = {};
  for (const asset of assets[networkName]) {
    assetMap[asset.token] = asset;
  }
  const chainlinkOracle =
    (await hre.ethers.getContract("ChainlinkOracle")) || (await hre.ethers.getContract("SequencerChainlinkOracle"));

  await configurePriceFeeds(hre, chainlinkOracle, "chainlink", chainlinkFeed[networkName]);

  const redstoneOracle = await hre.ethers.getContract("RedStoneOracle");

  await configurePriceFeeds(hre, redstoneOracle, "redstone", redstoneFeed[networkName]);
};

func.tags = ["feeds"];

export default func;
