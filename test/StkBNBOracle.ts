import { smock } from "@defi-wonderland/smock";
import chai from "chai";
import { parseUnits } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { ADDRESSES } from "../helpers/deploymentConfig";
import { IPStakePool, ResilientOracleInterface } from "../typechain-types";
import { addr0000 } from "./utils/data";

const { expect } = chai;
chai.use(smock.matchers);

const { stkBNB } = ADDRESSES.bscmainnet;
const EXP_SCALE = parseUnits("1", 18);
const BNB_USD_PRICE = parseUnits("300", 18); // 300 USD for 1 BNB
const TOTAL_WEI = parseUnits("17173.956674843638040397", 18);
const POOL_TOKEN_SUPPLY = parseUnits("16497.681117925810757967", 18);
const BNB = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";

describe("StkBNBOracle unit tests", () => {
  let stkBNBStakePoolMock;
  let resilientOracleMock;
  let StkBNBOracle;
  let StkBNBOracleFactory;
  before(async () => {
    //  To initialize the provider we need to hit the node with any request
    await ethers.getSigners();
    resilientOracleMock = await smock.fake<ResilientOracleInterface>("ResilientOracleInterface");
    resilientOracleMock.getPrice.returns(BNB_USD_PRICE);

    stkBNBStakePoolMock = await smock.fake<IPStakePool>("IPStakePool");
    stkBNBStakePoolMock.exchangeRate.returns({
      totalWei: TOTAL_WEI,
      poolTokenSupply: POOL_TOKEN_SUPPLY,
    });
    StkBNBOracleFactory = await ethers.getContractFactory("StkBNBOracle");
  });

  describe("deployment", () => {
    it("revert if stakePool address is 0", async () => {
      await expect(StkBNBOracleFactory.deploy(addr0000, stkBNB, BNB, resilientOracleMock.address)).to.be.reverted;
    });
    it("revert if stkBNB address is 0", async () => {
      await expect(StkBNBOracleFactory.deploy(stkBNBStakePoolMock.address, addr0000, BNB, resilientOracleMock.address)).to.be
        .reverted;
    });
    it("revert if resilientOracle address is 0", async () => {
      await expect(StkBNBOracleFactory.deploy(stkBNBStakePoolMock.address, stkBNB, BNB, addr0000)).to.be.reverted;
    });
    it("should deploy contract", async () => {
      StkBNBOracle = await StkBNBOracleFactory.deploy(stkBNBStakePoolMock.address, stkBNB, BNB, resilientOracleMock.address);
    });
  });

  describe("getPrice", () => {
    it("revert if ankrBNB address is wrong", async () => {
      await expect(StkBNBOracle.getPrice(addr0000)).to.be.revertedWith("wrong token address");
    });

    it("should get correct price", async () => {
      const expectedPrice = TOTAL_WEI.mul(EXP_SCALE).div(POOL_TOKEN_SUPPLY).mul(BNB_USD_PRICE).div(EXP_SCALE);
      expect(await StkBNBOracle.getPrice(stkBNB)).to.equal(expectedPrice);
    });
  });
});
