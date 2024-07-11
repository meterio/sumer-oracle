import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy, catchUnknownSigner } = deployments;
  const { deployer } = await getNamedAccounts();

  const networkName: string = network.name === "hardhat" ? "bsctestnet" : network.name;

  const { nativeMarket, nativeAsset } = ADDRESSES[networkName];

  const proxyOwnerAddress = ADDRESSES[networkName].timelock || deployer;
  const boundValidator = await hre.ethers.getContract("BoundValidator");
  const accessControlManager = await hre.ethers.getContract("AccessControlManager");
  if (!accessControlManager) {
    throw new Error(`AccessControlManager required`);
  }

  if (accessControlManager.address !== ADDRESSES[networkName].acm) {
    throw new Error(`AccessControlManager mismach with acm settings`);
  }
  const accessControlManagerAddress = accessControlManager.address;

  await catchUnknownSigner(
    deploy("ResilientOracle", {
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [nativeMarket, nativeAsset, boundValidator.address, accessControlManagerAddress],
      // proxy: {
      //   owner: proxyOwnerAddress,
      //   proxyContract: "OptimizedTransparentProxy",
      // },
    }),
  );
};

export default func;
func.tags = ["update"];
