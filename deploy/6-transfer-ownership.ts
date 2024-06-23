import hre from "hardhat";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { ADDRESSES } from "../helpers/deploymentConfig";

const transferOwnership = async function (contractName: string, deployer: string, proxyOwnerAddress: string) {
  const contract = await hre.ethers.getContractOrNull(contractName);
  if (contract) {
    const resilientOracleOwner = await contract.owner();
    if (resilientOracleOwner === deployer) {
      if (deployer !== proxyOwnerAddress) {
        await (await contract.transferOwnership(proxyOwnerAddress)).wait(1);
        console.log(`Ownership of ${contractName} transfered from deployer to Timelock (${proxyOwnerAddress})`);
      } else {
        console.log(`Deployer is ProxyOwner, skip transferOwnership for ${contractName}`);
      }
    }
  }
};

const func: DeployFunction = async function ({ getNamedAccounts, network }: HardhatRuntimeEnvironment) {
  const { deployer } = await getNamedAccounts();

  const networkName: string = network.name === "hardhat" ? "metertest" : network.name;

  const proxyOwnerAddress = network.live ? ADDRESSES[networkName].timelock || deployer : deployer;
  if (proxyOwnerAddress === "") {
    console.log(`proxyOwner is empty, skip calling transferOwnership`);
  }
  if (proxyOwnerAddress === deployer) {
    console.log(`proxyOwner is the same with deployer, skip calling transferOwnership`);
  }

  await transferOwnership("BoundValidator", deployer, proxyOwnerAddress);
  await transferOwnership("ResilientOracle", deployer, proxyOwnerAddress);
  await transferOwnership("ChainlinkOracle", deployer, proxyOwnerAddress);
  await transferOwnership("MockChainlinkOracle", deployer, proxyOwnerAddress);
  await transferOwnership("SequencerChainlinkOracle", deployer, proxyOwnerAddress);
  await transferOwnership("RedStoneOracle", deployer, proxyOwnerAddress);
  await transferOwnership("PythOracle", deployer, proxyOwnerAddress);
  await transferOwnership("MockEtherFiLiquidityPool", deployer, proxyOwnerAddress);
};

export default func;
func.tags = ["deploy"];
