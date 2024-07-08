import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, Asset, Oracle, Oracles, assets, getOraclesData } from "../helpers/deploymentConfig";

const setTokenConfigOnResilientOracle = async (hre: HardhatRuntimeEnvironment, asset: Asset, oracleConfig: Oracle) => {
  const resilientOracle = await hre.ethers.getContract("ResilientOracle");
  const configOnChain = await resilientOracle.getTokenConfig(asset.address);

  const oracleLengthMismatch = configOnChain.oracles.length !== oracleConfig.oracles.length;
  const oracleMismatch =
    oracleLengthMismatch ||
    configOnChain.oracles.some(
      (o: string, index: number) => o.toLowerCase() !== oracleConfig.oracles[index].toLowerCase(),
    );
  const flagLengthMismatch = configOnChain.enableFlagsForOracles.length !== oracleConfig.enableFlagsForOracles.length;

  const flagsMismatch =
    flagLengthMismatch ||
    configOnChain.enableFlagsForOracles.some(
      (o: boolean, index: number) => o !== oracleConfig.enableFlagsForOracles[index],
    );
  if (configOnChain.asset.toLowerCase() !== asset.address.toLowerCase() || oracleMismatch || flagsMismatch) {
    console.log(`Configured ${asset.token} on resilient oracle with ${JSON.stringify(oracleConfig.oracles)}`);

    await (
      await resilientOracle.setTokenConfig([asset.address, oracleConfig.oracles, oracleConfig.enableFlagsForOracles])
    ).wait(1);
  } else {
    console.log(`Checked ${asset.token} on resilient oracle`);
  }
};

const configurePriceFeeds = async (hre: HardhatRuntimeEnvironment): Promise<void> => {
  const networkName = hre.network.name;

  const binanceOracle = await hre.ethers.getContractOrNull("BinanceOracle");
  const chainlinkOracle =
    (await hre.ethers.getContractOrNull("ChainlinkOracle")) ||
    (await hre.ethers.getContractOrNull("SequencerChainlinkOracle"));
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

      const priceOnChain = await chainlinkOracle.prices(assetConfig.asset);
      if (!priceOnChain.eq(assetConfig.price)) {
        console.log(`Set direct price for ${asset.token} on ${oracle} oracle with ${JSON.stringify(assetConfig)}`);

        await (await chainlinkOracle.setDirectPrice(assetConfig.asset, assetConfig.price)).wait(1);
      } else {
        console.log(`Checked direct price for ${asset.token} on ${oracle} oracle`);
      }
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
            console.log(`Config ${asset.token} on ${oracle} oracle with ${JSON.stringify(tokenConfig)}`);
            await (
              await pythOracle.setTokenConfig([tokenConfig.pythId, tokenConfig.asset, tokenConfig.maxStalePeriod])
            ).wait(1);
          } else {
            console.log(`Checked ${asset.token} settings on ${oracle} oracle`);
          }
        } else {
          console.log(`pythOracle is null!, can not configure`);
        }
      } else if (oracle === "chainlink" || oracle === "redstone") {
        const oracleContract = await hre.ethers.getContractAt(
          "ChainlinkOracle",
          oraclesData[oracle].underlyingOracle.address,
        );
        const configOnChain = await oracleContract.tokenConfigs(tokenConfig.asset);

        if (
          configOnChain.asset.toLowerCase() !== tokenConfig.asset.toLowerCase() ||
          configOnChain.feed !== tokenConfig.feed ||
          configOnChain.maxStalePeriod.toNumber() !== tokenConfig.maxStalePeriod
        ) {
          console.log(`Config ${asset.token} on ${oracle} oracle with ${JSON.stringify(tokenConfig)}`);

          await (
            await oracleContract.setTokenConfig([tokenConfig.asset, tokenConfig.feed, tokenConfig.maxStalePeriod])
          ).wait(1);
        } else {
          console.log(`Checked ${asset.token} settings on ${oracle} oracle`);
        }
      } else if (oracle === "pendle") {
        const oracleContract = await hre.ethers.getContractAt(
          `PendleOracle`,
          oraclesData[oracle].underlyingOracle.address,
        );
        const configOnChain = await oracleContract.tokenConfigs(tokenConfig.asset);

        if (
          configOnChain.asset.toLowerCase() !== tokenConfig.asset.toLowerCase() ||
          configOnChain.market !== tokenConfig.market ||
          configOnChain.twapDuration !== tokenConfig.twapDuration
        ) {
          console.log(`Config ${asset.token} on ${oracle} oracle with ${JSON.stringify(tokenConfig)}`);

          await (
            await oracleContract.setTokenConfig([tokenConfig.asset, tokenConfig.market, tokenConfig.twapDuration])
          ).wait(1);
        } else {
          console.log(`Checked ${asset.token} settings on ${oracle} oracle`);
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

    if (asset.denominatedBy) {
      console.log("asset.denominatedby ", asset.denominatedBy);
      // one jump oracle
      const oneJumpOracle = await ethers.getContract(`${asset.token}Oracle`);
      if (!oneJumpOracle) {
        throw new Error(`could not find specific oracle for ${asset.token}`);
      }
      await setTokenConfigOnResilientOracle(hre, asset, {
        oracles: [oneJumpOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
        enableFlagsForOracles: [true, false, false],
        underlyingOracle: oneJumpOracle,
      });
    } else {
      await setTokenConfigOnResilientOracle(hre, asset, oraclesData[oracle]);
    }
  }
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await configurePriceFeeds(hre);
};

func.tags = ["feeds"];

export default func;
