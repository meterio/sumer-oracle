import hre, { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, SEQUENCER, assets, chainlinkFeed, getOraclesData, redstoneFeed } from "../helpers/deploymentConfig";
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

  const { nativeMarket, nativeAsset } = ADDRESSES[networkName];

  if (!ADDRESSES[networkName].acm || ADDRESSES[networkName].acm === ethers.constants.AddressZero) {
    await deploy("AccessControlManager", {
      from: deployer,
      args: [],
      log: true,
      autoMine: true,
    });
  }

  if (!nativeMarket) {
    throw new Error("nativeMarket must NOT be empty");
  }
  if (!nativeAsset) {
    throw new Error("nativeAsset must NOT be empty");
  }

  const accessControlManager = await hre.ethers.getContract("AccessControlManager");
  if (!accessControlManager) {
    throw new Error(`AccessControlManager required`);
  }

  if (accessControlManager.address !== ADDRESSES[networkName].acm) {
    throw new Error(`AccessControlManager mismach with acm settings`);
  }
  const accessControlManagerAddress = accessControlManager.address;

  const proxyOwnerAddress = ADDRESSES[networkName].timelock || deployer;

  await deploy("BoundValidator", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [],
    proxy: {
      owner: proxyOwnerAddress,
      proxyContract: "OptimizedTransparentProxy",
      execute: {
        init: {
          methodName: "initialize",
          args: [accessControlManagerAddress],
        },
      },
    },
  });

  const boundValidator = await hre.ethers.getContract("BoundValidator");

  await deploy("ResilientOracle", {
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: [nativeMarket, nativeAsset, boundValidator.address, accessControlManagerAddress],
    // proxy: {
    //   owner: proxyOwnerAddress,
    //   proxyContract: "OptimizedTransparentProxy",
    //   execute: {
    //     init: {
    //       methodName: "initialize",
    //       args: [accessControlManagerAddress],
    //     },
    //   },
    // },
  });

  const sequencer = SEQUENCER[network.name];
  let contractName = "ChainlinkOracle";
  if (sequencer !== undefined) contractName = "SequencerChainlinkOracle";

  await deploy(contractName, {
    contract: contractName,
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: sequencer ? [sequencer, accessControlManagerAddress] : [accessControlManagerAddress],
  });

  await deploy("RedStoneOracle", {
    contract: contractName,
    from: deployer,
    log: true,
    deterministicDeployment: false,
    args: sequencer ? [sequencer, accessControlManagerAddress] : [accessControlManagerAddress],
  });

  const { pythOracleAddress } = ADDRESSES[networkName];

  // Skip if no pythOracle address in config
  if (pythOracleAddress) {
    await deploy("PythOracle", {
      contract: "PythOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [pythOracleAddress, accessControlManagerAddress],
    });
  }

  const { ptOracle } = ADDRESSES[networkName];
  const resilientOracle = await hre.ethers.getContract("ResilientOracle");

  // Skip if no ptOracle address in config
  if (ptOracle) {
    await deploy("PendleOracle", {
      contract: "PendleOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [accessControlManagerAddress, ptOracle, resilientOracle.address],
    });
  }

  // deploy OneJumpOracle for token with `denominatedBy` field in asset
  for (const asset of assets[networkName]) {
    const oneJumpNames: { [key: string]: boolean } = {};

    if (asset.denominatedBy) {
      if (!(asset.denominatedBy in ADDRESSES[networkName])) {
        throw new Error(`address for token ${asset.denominatedBy} must be configured in ADDRESSES`);
      }

      const denominator = ADDRESSES[networkName][asset.denominatedBy];
      if (chainlinkFeed[networkName] && chainlinkFeed[networkName][`${asset.token}/${asset.denominatedBy}`]) {
        const chainlinkOracle = await ethers.getContract(contractName);
        const oneJumpName = `OneJumpOracle_${asset.denominatedBy}_Chainlink`;
        if (!oneJumpNames[oneJumpName]) {
          await deploy(oneJumpName, {
            contract: "OneJumpOracle",
            from: deployer,
            log: true,
            deterministicDeployment: false,
            args: [denominator, resilientOracle.address, chainlinkOracle.address],
            // skipIfAlreadyDeployed: true,
          });
        } else {
          console.log(`skip ${oneJumpName}, already deployed`);
        }
        oneJumpNames[oneJumpName] = true;
      }

      if (redstoneFeed[networkName] && redstoneFeed[networkName][`${asset.token}/${asset.denominatedBy}`]) {
        const redstoneOracle = await ethers.getContract("RedStoneOracle");
        const oneJumpName = `OneJumpOracle_${asset.denominatedBy}_RedStone`;
        if (!oneJumpNames[oneJumpName]) {
          await deploy(oneJumpName, {
            contract: "OneJumpOracle",
            from: deployer,
            log: true,
            deterministicDeployment: false,
            args: [denominator, resilientOracle.address, redstoneOracle.address],
          });
        } else {
          console.log(`skip ${oneJumpName}, already deployed`);
        }
        oneJumpNames[oneJumpName] = true;
      }
    }
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

  await givePermission(
    accessControlManager as AccessControlManager,
    "PendleOracle",
    "setTokenConfig(TokenConfig)",
    deployer,
  );

  await givePermission(
    accessControlManager as AccessControlManager,
    "BoundValidator",
    "setValidateConfig(ValidateConfig)",
    deployer,
  );
};

export default func;
func.tags = ["oracles"];
