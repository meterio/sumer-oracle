import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { Oracles, assets, getOraclesData } from "../helpers/deploymentConfig";

const configurePriceFeeds = async (hre: HardhatRuntimeEnvironment): Promise<void> => {
  const networkName = hre.network.name;

  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const binanceOracle = await hre.ethers.getContractOrNull("BinanceOracle");
  const chainlinkOracle = await hre.ethers.getContractOrNull("ChainlinkOracle");
  const pythOracle = await hre.ethers.getContractOrNull("PythOracle");
  const oraclesData: Oracles = await getOraclesData();

  for (const asset of assets[networkName]) {
    const { oracle } = asset;
    console.log(`Configuring ${asset.token}`);
    // console.log(`Configure ${oracle} oracle for ${asset.token}`);

    const { getTokenConfig, getDirectPriceConfig } = oraclesData[oracle];

    if (
      oraclesData[oracle].underlyingOracle.address === chainlinkOracle?.address &&
      getDirectPriceConfig !== undefined
    ) {
      const assetConfig: any = getDirectPriceConfig(asset);
      console.log(`Set direct price for ${asset.token} on pythOracle with`, assetConfig.asset, assetConfig.price);
      await (await chainlinkOracle.setDirectPrice(assetConfig.asset, assetConfig.price)).wait(1);
    }

    if (oraclesData[oracle].underlyingOracle.address !== binanceOracle?.address && getTokenConfig !== undefined) {
      const tokenConfig: any = getTokenConfig(asset, networkName);

      if (oracle === "pyth") {
        if (pythOracle) {
          const configOnChain = await pythOracle.tokenConfigs(tokenConfig.asset);

          if (
            configOnChain.pythId !== tokenConfig.pythId ||
            configOnChain.asset.toLowerCase() !== tokenConfig.asset.toLowerCase() ||
            configOnChain.maxStalePeriod.toNumber() !== tokenConfig.maxStalePeriod
          ) {
            console.log(
              `Set token config for ${asset.token} on ${oracle} with`,
              tokenConfig.pythId,
              tokenConfig.asset,
              tokenConfig.maxStalePeriod,
            );
            await (
              await pythOracle.setTokenConfig([tokenConfig.pythId, tokenConfig.asset, tokenConfig.maxStalePeriod])
            ).wait(1);
          } else {
            console.log(`Checked token config ${asset.token} on ${oracle}, nothing changed`);
          }
        } else {
          console.log(`pythOracle is null!, can not configure`);
        }
      } else {
        const oracleContract = await hre.ethers.getContractAt(
          "ResilientOracle",
          oraclesData[oracle].underlyingOracle.address,
        );
        const configOnChain = await oracleContract.tokenConfigs(tokenConfig.asset);

        if (
          configOnChain.asset.toLowerCase() !== tokenConfig.asset.toLowerCase() ||
          configOnChain.feed !== tokenConfig.feed ||
          configOnChain.maxStalePeriod.toNumber() !== tokenConfig.maxStalePeriod
        ) {
          console.log(
            `Set token config for ${asset.token} on ${oracle} with`,
            tokenConfig.asset,
            tokenConfig.feed,
            tokenConfig.maxStalePeriod,
          );

          await (
            await oracleContract.setTokenConfig([tokenConfig.asset, tokenConfig.feed, tokenConfig.maxStalePeriod])
          ).wait(1);
        } else {
          console.log(`Checked token config ${asset.token} on ${oracle}, nothing changed`);
        }
      }
    }

    const { getStalePeriodConfig } = oraclesData[oracle];
    if (oraclesData[oracle].underlyingOracle.address === binanceOracle?.address && getStalePeriodConfig !== undefined) {
      const tokenConfig: any = getStalePeriodConfig(asset);
      console.log(
        `Set maxStalePeriod for ${asset.token} on BinanceOracle with`,
        tokenConfig.pythId,
        tokenConfig.asset,
        tokenConfig.maxStalePeriod,
      );

      await (await binanceOracle.setMaxStalePeriod(...tokenConfig)).wait(1);
    }

    const configOnChain = await resilientOracle.getTokenConfig(asset.address);

    const oracleMismatch = configOnChain.oracles.some(
      (o: string, index: number) => o.toLowerCase() !== oraclesData[oracle].oracles[index].toLowerCase(),
    );
    const flagsMismatch = configOnChain.enableFlagsForOracles.some(
      (o: boolean, index: number) => o !== oraclesData[oracle].enableFlagsForOracles[index],
    );
    if (
      configOnChain.asset.toLowerCase() !== asset.address.toLowerCase() ||
      configOnChain.oracles.length !== oraclesData[oracle].oracles.length ||
      configOnChain.enableFlagsForOracles.length !== oraclesData[oracle].enableFlagsForOracles.length ||
      oracleMismatch ||
      flagsMismatch
    ) {
      console.log(``);
      console.log(`Configure resilient oracle for ${asset.token}`);

      await (
        await resilientOracle.setTokenConfig([
          asset.address,
          oraclesData[oracle].oracles,
          oraclesData[oracle].enableFlagsForOracles,
        ])
      ).wait(1);
    } else {
      console.log(`Checked token config ${asset.token} on resilient oracle, nothing changed`);
    }
  }
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (hre.network.live) {
    await configurePriceFeeds(hre);
  } else {
    throw Error("This script is only used for live networks.");
  }
};

func.tags = ["VIP"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name === "hardhat";

export default func;
