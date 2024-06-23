import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, ANY_CONTRACT, AccessControlEntry } from "../helpers/deploymentConfig";
import { AccessControlManager } from "../typechain-types";

const acceptOwnership = async (
  contractName: string,
  targetOwner: string,
  hre: HardhatRuntimeEnvironment,
): Promise<void> => {
  if (!hre.network.live) {
    return;
  }
  const abi = ["function owner() view returns (address)"];
  let deployment;
  try {
    deployment = await hre.deployments.get(contractName);
  } catch (error: any) {
    if (error.message.includes("No deployment found for")) {
      return;
    }
    throw error;
  }
  const contract = await ethers.getContractAt(abi, deployment.address);
  if ((await contract.owner()) === targetOwner) {
    return;
  }
  console.log(`Accept the admin rights over ${contractName}`);
  await (await contract.acceptOwnership()).wait(1);
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
      console.log(`Give permission ${method} on ${target} to ${caller}`);
      await (await accessControlManager.giveCallPermission(target, method, caller)).wait(1);
      return true;
    }),
  );
};

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const owner = ADDRESSES[hre.network.name].timelock;
  const { deployer } = await hre.getNamedAccounts();
  if (hre.network.live) {
    if (owner && owner !== deployer) {
      await acceptOwnership("ResilientOracle", owner, hre);
      await acceptOwnership("ChainlinkOracle", owner, hre);
      await acceptOwnership("RedStoneOracle", owner, hre);
      await acceptOwnership("BoundValidator", owner, hre);
      await configureAccessControls(hre);
    } else {
      console.log(`Timelock is deployer, skip configuring AccessControlManager and calling acceptOwnership`);
    }
  } else {
    throw Error("This script is only used for live networks.");
  }
};

func.tags = ["VIP"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.name === "hardhat";

export default func;
