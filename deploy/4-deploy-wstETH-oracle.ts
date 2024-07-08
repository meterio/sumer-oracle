import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, assets } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await ethers.getContract("ResilientOracle");
  const networkName: string = network.name === "hardhat" ? "bsctestnet" : network.name;

  let found = false;

  for (const asset of assets[networkName]) {
    if (asset.token === "wstETH") {
      found = true;
      break;
    }
  }

  const { stETH } = ADDRESSES[network.name];

  if (found && stETH) {
    // deply Equivalence and NonEquivalence on Ethereum
    await deploy("WstETHOracle", {
      contract: "WstETHOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [stETH, resilientOracle.address],
    });
  }
};

export default func;
func.tags = ["wstETH"];
