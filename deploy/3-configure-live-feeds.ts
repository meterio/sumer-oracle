import { BigNumberish } from "ethers";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
  ADDRESSES,
  ANY_CONTRACT,
  AccessControlEntry,
  Oracles,
  assets,
  getOraclesData,
} from "../helpers/deploymentConfig";
import { AccessControlManager } from "../typechain-types";

interface GovernanceCommand {
  contract: string;
  signature: string;
  parameters: any[];
  value: BigNumberish;
}

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
    console.log(`Configure ${oracle} oracle for ${asset.token}`);

    const { getTokenConfig, getDirectPriceConfig } = oraclesData[oracle];

    if (
      oraclesData[oracle].underlyingOracle.address === chainlinkOracle?.address &&
      getDirectPriceConfig !== undefined
    ) {
      const assetConfig: any = getDirectPriceConfig(asset);
      await (await chainlinkOracle.setDirectPrice(assetConfig.asset, assetConfig.price)).wait(1);
    }

    if (oraclesData[oracle].underlyingOracle.address !== binanceOracle?.address && getTokenConfig !== undefined) {
      const tokenConfig: any = getTokenConfig(asset, networkName);
      console.log(oraclesData[oracle].underlyingOracle.address, tokenConfig);

      if (oracle === "pyth") {
        if (pythOracle) {
          console.log(`calling`, pythOracle.address, `with`, [
            tokenConfig.pythId,
            tokenConfig.asset,
            tokenConfig.maxStalePeriod,
          ]);
          await (
            await pythOracle.setTokenConfig([tokenConfig.pythId, tokenConfig.asset, tokenConfig.maxStalePeriod])
          ).wait(1);
        } else {
          console.log(`pythOracle is null!, can not configure`);
        }
      } else {
        const oracleContract = await hre.ethers.getContractAt(
          "ResilientOracle",
          oraclesData[oracle].underlyingOracle.address,
        );
        await (
          await oracleContract.setTokenConfig([tokenConfig.asset, tokenConfig.feed, tokenConfig.maxStalePeriod])
        ).wait(1);
      }
    }

    const { getStalePeriodConfig } = oraclesData[oracle];
    if (oraclesData[oracle].underlyingOracle.address === binanceOracle?.address && getStalePeriodConfig !== undefined) {
      const tokenConfig: any = getStalePeriodConfig(asset);

      await (await binanceOracle.setMaxStalePeriod(...tokenConfig)).wait(1);
    }

    console.log(``);
    console.log(`Configure resilient oracle for ${asset.token}`);

    await (
      await resilientOracle.setTokenConfig([
        asset.address,
        oraclesData[oracle].oracles,
        oraclesData[oracle].enableFlagsForOracles,
      ])
    ).wait(1);
  }
};

const acceptOwnership = async (
  contractName: string,
  targetOwner: string,
  hre: HardhatRuntimeEnvironment,
): Promise<GovernanceCommand[]> => {
  if (!hre.network.live) {
    return [];
  }
  const abi = ["function owner() view returns (address)"];
  let deployment;
  try {
    deployment = await hre.deployments.get(contractName);
  } catch (error: any) {
    if (error.message.includes("No deployment found for")) {
      return [];
    }
    throw error;
  }
  const contract = await ethers.getContractAt(abi, deployment.address);
  if ((await contract.owner()) === targetOwner) {
    return [];
  }
  console.log(`Accept the admin rights over ${contractName}`);
  return [
    {
      contract: deployment.address,
      signature: "acceptOwnership()",
      parameters: [],
      value: 0,
    },
  ];
};

const makeRole = (mainnetBehavior: boolean, targetContract: string, method: string): string =>
  ethers.utils.keccak256(ethers.utils.solidityPack(["address", "string"], [targetContract, method]));

const hasPermission = async (
  accessControl: AccessControlManager,
  targetContract: string,
  method: string,
  caller: string,
): Promise<boolean> => {
  const role = makeRole(false, targetContract, method);
  return accessControl.hasRole(role, caller);
};

const timelockOraclePermissions = (timelock: string): AccessControlEntry[] => {
  const methods = [
    "pause()",
    "unpause()",
    "setOracle(address,address,uint8)",
    "enableOracle(address,uint8,bool)",
    "setTokenConfig(TokenConfig)",
    "setDirectPrice(address,uint256)",
    "setValidateConfig(ValidateConfig)",
    "setMaxStalePeriod(string,uint256)",
    "setSymbolOverride(string,string)",
    "setUnderlyingPythOracle(address)",
  ];
  return methods.map(method => ({
    caller: timelock,
    target: ANY_CONTRACT,
    method,
  }));
};

const configureAccessControls = async (hre: HardhatRuntimeEnvironment): Promise<void> => {
  const networkName = hre.network.name;
  const accessControlManagerAddress = ADDRESSES[networkName].acm;

  const accessControlConfig: AccessControlEntry[] = timelockOraclePermissions(ADDRESSES[networkName].timelock);
  const accessControlManager = await ethers.getContractAt<AccessControlManager>(
    "AccessControlManager",
    accessControlManagerAddress,
  );

  await Promise.all(
    accessControlConfig.map(async (entry: AccessControlEntry) => {
      const { caller, target, method } = entry;
      if (await hasPermission(accessControlManager, caller, method, target)) {
        return [];
      }
      await (await accessControlManager.giveCallPermission(target, method, caller)).wait(1);
      return true;
    }),
  );
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const owner = ADDRESSES[hre.network.name].timelock;
  const { deployer } = await hre.getNamedAccounts();
  if (hre.network.live) {
    await configureAccessControls(hre);
    if (owner && owner !== deployer) {
      await acceptOwnership("ResilientOracle", owner, hre);
      await acceptOwnership("ChainlinkOracle", owner, hre);
      await acceptOwnership("RedStoneOracle", owner, hre);
      await acceptOwnership("BoundValidator", owner, hre);
      await acceptOwnership("BinanceOracle", owner, hre);
    } else {
      console.log(`Timelock is deployer, skip configuring AccessControlManager and calling acceptOwnership`);
    }
    await configurePriceFeeds(hre);
  } else {
    throw Error("This script is only used for live networks.");
  }
};

func.tags = ["VIP"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name === "hardhat";

export default func;
