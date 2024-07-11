import { Contract } from "ethers";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  Asset,
  Oracle,
  Oracles,
  assets,
  chainlinkFeed,
  getOraclesData,
  redstoneFeed,
} from "../helpers/deploymentConfig";

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

  const chainlinkOracle =
    (await hre.ethers.getContractOrNull("ChainlinkOracle")) ||
    (await hre.ethers.getContractOrNull("SequencerChainlinkOracle"));
  const pythOracle = await hre.ethers.getContractOrNull("PythOracle");
  const oraclesData: Oracles = await getOraclesData();

  for (const asset of assets[networkName]) {
    const { oracle } = asset;
    console.log(`Configuring ${asset.token}`);
    // console.log(`Configure ${oracle} oracle for ${asset.token}`);

    if (oraclesData[oracle]) {
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

      if (getTokenConfig !== undefined) {
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
            configOnChain.market.toLowerCase() !== tokenConfig.market.toLowerCase() ||
            configOnChain.twapDuration !== tokenConfig.twapDuration ||
            configOnChain.yieldToken.toLowerCase() !== tokenConfig.yieldToken.toLowerCase()
          ) {
            console.log(`Config ${asset.token} on ${oracle} oracle with ${JSON.stringify(tokenConfig)}`);

            await (
              await oracleContract.setTokenConfig([
                tokenConfig.asset,
                tokenConfig.market,
                tokenConfig.twapDuration,
                tokenConfig.yieldToken,
              ])
            ).wait(1);
          } else {
            console.log(`Checked ${asset.token} settings on ${oracle} oracle`);
          }
        }
      }
    }

    // setting up on ResilientOracle
    if (asset.denominatedBy) {
      console.log("asset.denominatedby ", asset.denominatedBy);
      // one jump oracle
      const oneJumps: string[] = [];
      let oneJumpOracle: Contract | null = null;
      if (chainlinkFeed[networkName][`${asset.token}/${asset.denominatedBy}`]) {
        const oneJumpOracle_chainlink = await ethers.getContractOrNull(
          `OneJumpOracle_${asset.denominatedBy}_Chainlink`,
        );
        if (oneJumpOracle_chainlink) {
          oneJumps.push(oneJumpOracle_chainlink.address);
          oneJumpOracle = oneJumpOracle_chainlink;
        }
      }

      if (redstoneFeed[networkName][`${asset.token}/${asset.denominatedBy}`]) {
        const oneJumpOracle_redstone = await ethers.getContractOrNull(`OneJumpOracle_${asset.denominatedBy}_RedStone`);
        if (oneJumpOracle_redstone) {
          oneJumps.push(oneJumpOracle_redstone.address);
        }
        if (!oneJumpOracle) {
          oneJumpOracle = oneJumpOracle_redstone;
        }
      }

      if (oneJumps.length <= 0) {
        throw new Error(`no OneJumpOracle via ${asset.denominatedBy} for ${asset.token}`);
      }
      const oracles: [string, string, string] = [
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
        ethers.constants.AddressZero,
      ];
      const enables: [boolean, boolean, boolean] = [false, false, false];

      oneJumps.forEach((v, i) => {
        oracles[i] = v;
        enables[i] = true;
      });

      await setTokenConfigOnResilientOracle(hre, asset, {
        oracles,
        enableFlagsForOracles: enables,
        underlyingOracle: oneJumpOracle!,
      });

      const boundValidator = await ethers.getContract("BoundValidator");

      const upperBoundRatio = BigInt(1.01e18);
      const lowerBoundRatio = BigInt(0.99e18);
      console.log(`Set lowerBound/uppperBound with 1% for ${asset.token} ${asset.address}`);
      await boundValidator.setValidateConfig([asset.address, upperBoundRatio, lowerBoundRatio]);
    } else if (!["pyth", "pendle", "chainlink", "redstone", "chainlinkFixed"].includes(asset.oracle)) {
      const standaloneOracle = await ethers.getContract(asset.oracle);
      await setTokenConfigOnResilientOracle(hre, asset, {
        oracles: [standaloneOracle.address, ethers.constants.AddressZero, ethers.constants.AddressZero],
        enableFlagsForOracles: [true, false, false],
        underlyingOracle: standaloneOracle,
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
