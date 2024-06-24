import { confirm } from "@inquirer/prompts";
import { BigNumber } from "ethers";
import { DeployFunction } from "hardhat-deploy/dist/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import { assets } from "../helpers/deploymentConfig";

const func: DeployFunction = async function ({
  ethers,
  network,
  deployments,
  getNamedAccounts,
}: HardhatRuntimeEnvironment) {
  const networkName: string = network.name === "hardhat" ? "bsctestnet" : network.name;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  for (const asset of assets[networkName]) {
    const needDeploy = await confirm({
      message: `Deploy Mock${asset.token}`,
      default: false,
    });

    if (needDeploy) {
      if (asset.token.startsWith("PT")) {
        const ptTokenName = asset.token;
        const ytTokenName = `YT${asset.token.slice(2)}`;
        const syTokenName = `SY${asset.token.slice(2)}`;
        const marketName = `Market${asset.token.slice(2)}`;

        await deploy(`Mock${ytTokenName}`, {
          from: deployer,
          log: true,
          deterministicDeployment: false,
          args: [`Mock${ytTokenName}`, `Mock${ytTokenName}`, 18],
          autoMine: true,
          contract: "BEP20Harness",
        });
        const ytToken = await ethers.getContract(`Mock${ytTokenName}`);

        await deploy(`Mock${syTokenName}`, {
          from: deployer,
          log: true,
          deterministicDeployment: false,
          args: [`Mock${syTokenName}`, `Mock${syTokenName}`, 18],
          autoMine: true,
          contract: "BEP20Harness",
        });

        const syToken = await ethers.getContract(`Mock${syTokenName}`);
        await deploy(`Mock${ptTokenName}`, {
          from: deployer,
          log: true,
          deterministicDeployment: false,
          args: [`Mock${ptTokenName}`, `Mock${ptTokenName}`, 18, syToken.address],
          autoMine: true,
          contract: "MockPendlePt",
        });

        const ptToken = await ethers.getContract(`Mock${ptTokenName}`);
        await deploy(`Mock${marketName}`, {
          from: deployer,
          log: true,
          deterministicDeployment: false,
          args: [syToken.address, ptToken.address, ytToken.address],
          autoMine: true,
          contract: "MockPendleMarket",
        });

        const ptMarket = await ethers.getContract(`Mock${marketName}`);
        await deploy(`MockPendlePtOracle`, {
          from: deployer,
          log: true,
          deterministicDeployment: false,
          args: [],
          autoMine: true,
          contract: "MockPendlePtOracle",
        });
        const pendlePtOracle = await ethers.getContract("MockPendlePtOracle");
        await pendlePtOracle.setPtToSyRate(ptMarket.address, 1800, BigNumber.from("900000000000000000"));
      } else {
        await deploy(`Mock${asset.token}`, {
          from: deployer,
          log: true,
          deterministicDeployment: false,
          args: [`Mock${asset.token}`, `Mock${asset.token}`, 18],
          autoMine: true,
          contract: "BEP20Harness",
        });
      }
    }
  }
};

export default func;
func.tags = ["mock-tokens"];
func.skip = async (hre: HardhatRuntimeEnvironment) => hre.network.live;
