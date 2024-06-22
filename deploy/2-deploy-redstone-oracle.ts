import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES, SEQUENCER } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const proxyOwnerAddress = network.live ? ADDRESSES[network.name].timelock : deployer;

  console.log(`Timelock (${proxyOwnerAddress})`);

  const sequencer = SEQUENCER[network.name];
  let contractName = "ChainlinkOracle";
  if (sequencer !== undefined) contractName = "SequencerChainlinkOracle";

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
        args: network.live ? [ADDRESSES[network.name].acm] : [],
      },
    },
  });

  const redStoneOracle = await hre.ethers.getContract("RedStoneOracle");
  const redStoneOracleOwner = await redStoneOracle.owner();

  // if (redStoneOracleOwner === deployer && network.live) {
  //   await redStoneOracle.transferOwnership(proxyOwnerAddress);
  //   console.log(`Ownership of RedstoneOracle transfered from deployer to Timelock (${proxyOwnerAddress})`);
  // }
};

func.skip = async ({ network }: HardhatRuntimeEnvironment) =>
  !["hardhat", "sepolia", "ethereum", "arbitrum"].includes(network.name);
func.tags = ["deploy-redstone"];
export default func;
