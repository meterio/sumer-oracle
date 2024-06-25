import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const func: DeployFunction = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const resilientOracle = await ethers.getContract("ResilientOracle");
  const chainlinkOracle = await ethers.getContract("ChainlinkOracle");
  const proxyOwnerAddress = ADDRESSES[network.name].timelock || deployer;

  let { EtherFiLiquidityPool } = ADDRESSES[network.name];
  const { weETH, WETH } = ADDRESSES[network.name];

  if (network.name === "sepolia" || network.name === "ethereum") {
    if (!EtherFiLiquidityPool) {
      // deploy mock liquidity pool
      await deploy("MockEtherFiLiquidityPool", {
        from: deployer,
        contract: "MockEtherFiLiquidityPool",
        args: [],
        log: true,
        autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks
        skipIfAlreadyDeployed: true,
      });

      const mockEtherFiLiquidityPool = await ethers.getContract("MockEtherFiLiquidityPool");
      EtherFiLiquidityPool = mockEtherFiLiquidityPool.address;
    }
    // deply Equivalence and NonEquivalence on Ethereum
    await deploy("WeETHOracle_Equivalence", {
      contract: "WeETHOracle",
      from: deployer,
      log: true,
      deterministicDeployment: false,
      args: [EtherFiLiquidityPool, weETH, WETH, resilientOracle.address],
      proxy: {
        owner: proxyOwnerAddress,
        proxyContract: "OptimizedTransparentProxy",
      },
      skipIfAlreadyDeployed: true,
    });
  }
};

export default func;
func.tags = ["weETH"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  !["hardhat", "sepolia", "ethereum", "arbitrum", "base"].includes(hre.network.name);
