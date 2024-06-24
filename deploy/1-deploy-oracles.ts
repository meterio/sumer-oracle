import hre, { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, SEQUENCER } from "../helpers/deploymentConfig";
import { AccessControlManager } from "../typechain-types";

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

const givePermission = async (
  accessControl: AccessControlManager,
  targetContractName: string,
  method: string,
  caller: string,
) => {
  const targetContract = await hre.ethers.getContractOrNull(targetContractName);
  if (targetContract) {
    const has = await hasPermission(accessControl, targetContract.address, method, caller);
    if (!has) {
      console.log(`Give permission ${method} on ${targetContractName} ${targetContract.address} to ${caller}`);
      await (await accessControl.giveCallPermission(targetContract.address, method, caller)).wait(1);
    } else {
      console.log(`Permission checked: ${method} on ${targetContractName} ${targetContract.address} to ${caller}`);
    }
  }
};

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName: string = network.name === "hardhat" ? "metertest" : network.name;

  console.log(`Timelock: ${ADDRESSES[networkName].timelock}`);

  const { vBNBAddress } = ADDRESSES[networkName];
  const { VAIAddress } = ADDRESSES[networkName];

  if (!network.live) {
    await deploy("AccessControlManager", {
      from: deployer,
      args: [],
      log: true,
      autoMine: true,
    });
  }

  const accessControlManager = await hre.ethers.getContract("AccessControlManager");
  if (!accessControlManager) {
    throw new Error(`AccessControlManager required`);
  }

  if (accessControlManager.address !== ADDRESSES[networkName].acm) {
    throw new Error(`AccessControlManager mismach with acm settings`);
  }
  const accessControlManagerAddress = accessControlManager.address;

  const proxyOwnerAddress = network.live ? ADDRESSES[networkName].timelock || deployer : deployer;

  await deploy("BoundValidator", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [accessControlManagerAddress],
      },
    },
  });

  const boundValidator = await hre.ethers.getContract("BoundValidator");

  await deploy("ResilientOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [vBNBAddress, VAIAddress, boundValidator.address],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: [accessControlManagerAddress],
      },
    },
  });

  const sequencer = SEQUENCER[network.name];
  let contractName = "ChainlinkOracle";
  if (sequencer !== undefined) contractName = "SequencerChainlinkOracle";

  await deploy(contractName, {
    contract: network.live ? contractName : "MockChainlinkOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: sequencer ? [sequencer] : [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [accessControlManagerAddress] : [],
      },
    },
  });

  await deploy("RedStoneOracle", {
    contract: network.live ? contractName : "MockChainlinkOracle",
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: sequencer ? [sequencer] : [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        methodName: "initialize",
        args: network.live ? [accessControlManagerAddress] : [],
      },
    },
  });

  const { pythOracleAddress } = ADDRESSES[networkName];

  // Skip if no pythOracle address in config
  if (pythOracleAddress) {
    await deploy("PythOracle", {
      contract: network.live ? "PythOracle" : "MockPythOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
        execute: {
          methodName: "initialize",
          args: network.live ? [pythOracleAddress, accessControlManagerAddress] : [pythOracleAddress],
        },
      },
    });
  }

  await givePermission(
    accessControlManager as AccessControlManager,
    "ResilientOracle",
    "setTokenConfig(TokenConfig)",
    deployer,
  );

  await givePermission(
    accessControlManager as AccessControlManager,
    contractName,
    "setTokenConfig(TokenConfig)",
    deployer,
  );

  await givePermission(
    accessControlManager as AccessControlManager,
    contractName,
    "setDirectPrice(address,uint256)",
    deployer,
  );

  await givePermission(
    accessControlManager as AccessControlManager,
    "RedStoneOracle",
    "setTokenConfig(TokenConfig)",
    deployer,
  );

  await givePermission(
    accessControlManager as AccessControlManager,
    "PythOracle",
    "setTokenConfig(TokenConfig)",
    deployer,
  );
};

export default func;
func.tags = ["deploy"];
