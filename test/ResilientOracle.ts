import { smock } from "@defi-wonderland/smock";
import type { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import chai from "chai";
import { ethers, upgrades } from "hardhat";

import { BoundValidator, ChainlinkOracle, ResilientOracle } from "../typechain-types";
import { addr0000, addr1111, getSimpleAddress } from "./utils/data";
import { makeVToken } from "./utils/makeVToken";

const { expect } = chai;
chai.use(smock.matchers);

const getChainlinkOracle = async () => {
  const oracle = await smock.fake<ChainlinkOracle>("ChainlinkOracle");
  return oracle;
};

const getMockSimpleOracleOracle = async () => {
  const oracleFactory = await ethers.getContractFactory("MockSimpleOracle");
  const oracle = await oracleFactory.deploy();
  return oracle;
};

const getBoundValidator = async () => {
  const boundValidator = await smock.fake<BoundValidator>("BoundValidator");
  return boundValidator;
};

describe("Oracle plugin frame unit tests", function () {
  before(async function () {
    const signers: SignerWithAddress[] = await ethers.getSigners();
    const admin = signers[0];
    this.signers = signers;
    this.admin = admin;
    this.mainOracle = await getChainlinkOracle();
    this.pivotOracle = await getChainlinkOracle();
    this.fallbackOracle = await getChainlinkOracle();
    this.boundValidator = await getBoundValidator();
    this.simpleOracle = await getMockSimpleOracleOracle();
    this.vBnb = signers[5].address;
    this.bnbAddr = "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB";
  });

  beforeEach(async function () {
    const ResilientOracle = await ethers.getContractFactory("ResilientOracle", this.admin);
    const instance = <ResilientOracle>await upgrades.deployProxy(ResilientOracle, [this.boundValidator.address], {
      constructorArgs: [this.vBnb],
    });
    this.oracleBasement = instance;
  });

  describe("constructor", function () {
    it("sets address of owner", async function () {
      const owner = await this.oracleBasement.owner();
      expect(owner).to.equal(this.admin.address);
    });
  });

  describe("admin check", function () {
    it("only admin can call the setters", async function () {
      // setTokenConfigs
      const vToken = await makeVToken(
        this.admin,
        { name: "vETH", symbol: "vETH" },
        { name: "Ethereum", symbol: "ETH" },
      );
      const asset = await vToken.underlying();

      await expect(
        this.oracleBasement.connect(this.signers[2]).setTokenConfigs([
          {
            asset: asset,
            oracles: [addr0000, addr0000, addr0000],
            enableFlagsForOracles: [false, false, false],
          },
        ]),
      ).to.be.revertedWith("Ownable: caller is not the owner");

      // setTokenConfig
      await expect(
        this.oracleBasement.connect(this.signers[1]).setTokenConfig({
          asset: asset,
          oracles: [addr0000, addr0000, addr0000],
          enableFlagsForOracles: [false, false, false],
        }),
      ).to.be.revertedWith("Ownable: caller is not the owner");

      // setOracle
      await expect(this.oracleBasement.connect(this.signers[2]).setOracle(asset, addr0000, 0)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      // enableOracle
      await expect(this.oracleBasement.connect(this.signers[2]).enableOracle(asset, 0, false)).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );

      // pause & unpause
      await expect(this.oracleBasement.connect(this.signers[2]).pause()).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
      await expect(this.oracleBasement.connect(this.signers[2]).unpause()).to.be.revertedWith(
        "Ownable: caller is not the owner",
      );
    });

    it("transfer owner", async function () {
      const vToken = await makeVToken(
        this.admin,
        { name: "vETH", symbol: "vETH" },
        { name: "Ethereum", symbol: "ETH" },
      );
      const asset = await vToken.underlying();

      await this.oracleBasement.transferOwnership(this.signers[2].address);
      const newOwner = await this.oracleBasement.owner();
      expect(newOwner).to.equal(this.signers[2].address);
      await this.oracleBasement.connect(this.signers[2]).setTokenConfig({
        asset: asset,
        oracles: [addr1111, addr1111, addr1111],
        enableFlagsForOracles: [false, false, false],
      });
      expect((await this.oracleBasement.getTokenConfig(vToken.address)).oracles[0]).to.equal(addr1111);
    });
  });

  describe("token config", function () {
    describe("add single token config", function () {
      it("vToken can\"t be zero & main oracle can't be zero", async function () {
        await expect(
          this.oracleBasement.setTokenConfig({
            asset: addr0000,
            oracles: [addr1111, addr1111, addr1111],
            enableFlagsForOracles: [true, false, true],
          }),
        ).to.be.revertedWith("can't be zero address");

        await expect(
          this.oracleBasement.setTokenConfig({
            asset: addr1111,
            oracles: [addr0000, addr1111, addr0000],
            enableFlagsForOracles: [true, false, true],
          }),
        ).to.be.revertedWith("can't be zero address");
      });

      it("reset token config", async function () {
        const vToken = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset = await vToken.underlying();

        await this.oracleBasement.setTokenConfig({
          asset: asset,
          oracles: [addr1111, addr1111, addr1111],
          enableFlagsForOracles: [true, false, true],
        });
        expect((await this.oracleBasement.getTokenConfig(vToken.address)).enableFlagsForOracles[0]).to.equal(true);
        await this.oracleBasement.setTokenConfig({
          asset: asset,
          oracles: [addr1111, addr0000, addr0000],
          enableFlagsForOracles: [false, false, true],
        });
        expect((await this.oracleBasement.getTokenConfig(vToken.address)).enableFlagsForOracles[0]).to.equal(false);
      });

      it("token config added successfully & events check", async function () {
        const vToken = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset = await vToken.underlying();

        const result = await this.oracleBasement.setTokenConfig({
          asset: asset,
          oracles: [addr1111, addr1111, addr1111],
          enableFlagsForOracles: [true, false, true],
        });
        await expect(result)
          .to.emit(this.oracleBasement, "TokenConfigAdded")
          .withArgs(asset, addr1111, addr1111, addr1111);
      });
    });

    describe("batch add token configs", function () {
      it("length check", async function () {
        await expect(this.oracleBasement.setTokenConfigs([])).to.be.revertedWith("length can't be 0");
      });

      it("token config added successfully & data check", async function () {
        const vToken1 = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset1 = await vToken1.underlying();

        const vToken2 = await makeVToken(
          this.admin,
          { name: "vBTC", symbol: "vBTC" },
          { name: "Bitcoin", symbol: "BTC" },
        );
        const asset2 = await vToken2.underlying();

        await this.oracleBasement.setTokenConfigs([
          {
            asset: asset1,
            oracles: [addr1111, addr1111, addr0000],
            enableFlagsForOracles: [true, false, true],
          },
          {
            asset: asset2,
            oracles: [addr1111, getSimpleAddress(2), getSimpleAddress(3)],
            enableFlagsForOracles: [true, false, true],
          },
        ]);
        expect((await this.oracleBasement.getTokenConfig(vToken1.address)).oracles[0]).to.equal(addr1111);
        expect((await this.oracleBasement.getTokenConfig(vToken2.address)).oracles[1]).to.equal(getSimpleAddress(2));
        expect((await this.oracleBasement.getTokenConfig(vToken2.address)).enableFlagsForOracles[0]).to.equal(true);
        // non exist config
        await expect(this.oracleBasement.getTokenConfig(getSimpleAddress(8))).to.be.reverted;
      });
    });
  });

  describe("change oracle", function () {
    describe("set oracle", function () {
      it("null check", async function () {
        const vToken = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset = await vToken.underlying();

        // vToken can't be zero
        await expect(this.oracleBasement.setOracle(addr0000, addr1111, 0)).to.be.revertedWith("can't be zero address");

        // main oracle can't be zero
        await this.oracleBasement.setTokenConfig({
          asset: asset,
          oracles: [addr1111, addr1111, addr0000],
          enableFlagsForOracles: [true, false, true],
        });
        await expect(this.oracleBasement.setOracle(asset, addr0000, 0)).to.be.revertedWith(
          "can't set zero address to main oracle",
        );
        // nothing happens
        await this.oracleBasement.setOracle(asset, addr1111, 0);
        await this.oracleBasement.setOracle(asset, addr0000, 2);
      });

      it("existance check", async function () {
        const vToken = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset = await vToken.underlying();

        await expect(this.oracleBasement.setOracle(asset, addr1111, 0)).to.be.revertedWith("token config must exist");
      });

      it("oracle set successfully & data check", async function () {
        const vToken = await makeVToken(
          this.admin,
          { name: "vETH", symbol: "vETH" },
          { name: "Ethereum", symbol: "ETH" },
        );
        const asset = await vToken.underlying();

        await this.oracleBasement.setTokenConfig({
          asset: asset,
          oracles: [addr1111, addr1111, addr0000],
          enableFlagsForOracles: [true, false, true],
        });

        await this.oracleBasement.setOracle(asset, getSimpleAddress(2), 1);
        expect((await this.oracleBasement.getTokenConfig(vToken.address)).enableFlagsForOracles).to.eql([
          true,
          false,
          true,
        ]);
        expect((await this.oracleBasement.getTokenConfig(vToken.address)).oracles).to.eql([
          addr1111,
          getSimpleAddress(2),
          addr0000,
        ]);
      });
    });
  });

  describe("get underlying price", function () {
    let token1;
    let asset1;
    let token2;
    let asset2;
    let token3;
    let asset3;

    const token1FallbackPrice = 2222222;
    const token2FallbackPrice = 3333333;

    beforeEach(async function () {
      token1 = await makeVToken(this.admin, { name: "vETH", symbol: "vETH" }, { name: "Ethereum", symbol: "ETH" });
      asset1 = await token1.underlying();
      token1 = token1.address;

      token2 = await makeVToken(this.admin, { name: "vBTC", symbol: "vBTC" }, { name: "Bitcoin", symbol: "BTC" });
      asset2 = await token2.underlying();
      token2 = token2.address;

      token3 = this.vBnb;
      asset3 = this.bnbAddr;

      await this.oracleBasement.setTokenConfigs([
        {
          asset: asset1,
          oracles: [this.mainOracle.address, this.pivotOracle.address, this.fallbackOracle.address],
          enableFlagsForOracles: [true, true, false],
        },
        {
          asset: asset2,
          oracles: [this.mainOracle.address, this.pivotOracle.address, this.fallbackOracle.address],
          enableFlagsForOracles: [true, true, false],
        },
        {
          asset: asset3,
          oracles: [this.mainOracle.address, this.pivotOracle.address, this.fallbackOracle.address],
          enableFlagsForOracles: [true, true, false],
        },
      ]);
      this.fallbackOracle.getUnderlyingPrice.whenCalledWith(token1).returns(token1FallbackPrice);
      this.fallbackOracle.getUnderlyingPrice.whenCalledWith(token2).returns(token2FallbackPrice);
      this.fallbackOracle.getUnderlyingPrice.whenCalledWith(token3).returns(token2FallbackPrice);
    });
    it("revert when protocol paused", async function () {
      await this.oracleBasement.pause();
      await expect(this.oracleBasement.getUnderlyingPrice(token1)).to.be.revertedWith("resilient oracle is paused");
    });
    it("revert price when main oracle is disabled and there is no fallback oracle", async function () {
      await this.oracleBasement.enableOracle(asset1, 0, false);
      await expect(this.oracleBasement.getUnderlyingPrice(token1)).to.be.revertedWith("invalid resilient oracle price");
    });
    it("revert price main oracle returns 0 and there is no fallback oracle", async function () {
      await this.mainOracle.getUnderlyingPrice.whenCalledWith(token1).returns(0);
      await expect(this.oracleBasement.getUnderlyingPrice(token1)).to.be.revertedWith("invalid resilient oracle price");
    });
    it("revert if price fails checking", async function () {
      await this.mainOracle.getUnderlyingPrice.whenCalledWith(token1).returns(1000);
      // invalidate the main oracle
      await this.pivotOracle.getUnderlyingPrice.whenCalledWith(token1).returns(10000);
      await this.boundValidator.validatePriceWithAnchorPrice.returns(false);
      await expect(this.oracleBasement.getUnderlyingPrice(token1)).to.be.revertedWith("invalid resilient oracle price");
    });
    it("check price with/without pivot oracle", async function () {
      await this.mainOracle.getUnderlyingPrice.whenCalledWith(token1).returns(1000);
      await this.boundValidator.validatePriceWithAnchorPrice.returns(false);
      // empty pivot oracle
      await this.oracleBasement.setOracle(asset1, addr0000, 1);
      const price1 = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price1).to.equal(1000);
      // set oracle back
      await this.oracleBasement.setOracle(asset1, this.pivotOracle.address, 1);
      await this.mainOracle.getUnderlyingPrice.whenCalledWith(token1).returns(1000);
      await this.pivotOracle.getUnderlyingPrice.whenCalledWith(token1).returns(10000);
      // invalidate price
      await this.boundValidator.validatePriceWithAnchorPrice.returns(false);
      await expect(this.oracleBasement.getUnderlyingPrice(token1)).to.be.revertedWith("invalid resilient oracle price");
    });

    it("disable pivot oracle", async function () {
      await this.mainOracle.getUnderlyingPrice.whenCalledWith(token1).returns(1000);
      await this.mainOracle.getUnderlyingPrice.whenCalledWith(token3).returns(2000);
      // pivot passes the price...
      await this.boundValidator.validatePriceWithAnchorPrice.returns(true);
      // ...but pivot is disabled, so it won't come to invalidate
      await this.oracleBasement.enableOracle(asset1, 1, false);
      await this.oracleBasement.enableOracle(asset3, 1, false);
      const price1 = await this.oracleBasement.getUnderlyingPrice(token1);
      expect(price1).to.equal(1000);
      const price3 = await this.oracleBasement.getUnderlyingPrice(token3);
      expect(price3).to.equal(2000);
    });

    it("enable fallback oracle", async function () {
      await this.mainOracle.getUnderlyingPrice.whenCalledWith(token2).returns(1000);
      await this.mainOracle.getUnderlyingPrice.whenCalledWith(token3).returns(2000);
      // invalidate the price first
      await this.pivotOracle.getUnderlyingPrice.whenCalledWith(token2).returns(1000);
      await this.pivotOracle.getUnderlyingPrice.whenCalledWith(token3).returns(2000);

      await this.boundValidator.validatePriceWithAnchorPrice.returns(false);
      await expect(this.oracleBasement.getUnderlyingPrice(token2)).to.be.revertedWith("invalid resilient oracle price");
      await expect(this.oracleBasement.getUnderlyingPrice(token3)).to.be.revertedWith("invalid resilient oracle price");

      // enable fallback oracle
      await this.mainOracle.getUnderlyingPrice.whenCalledWith(token2).returns(0);
      await this.boundValidator.validatePriceWithAnchorPrice.returns(true);
      await this.oracleBasement.enableOracle(asset1, 2, true);
      await expect(this.oracleBasement.getUnderlyingPrice(token2)).to.be.revertedWith("invalid resilient oracle price");

      // set fallback oracle to zero address
      await this.oracleBasement.setOracle(asset2, addr0000, 2);
      await expect(this.oracleBasement.getUnderlyingPrice(token2)).to.be.revertedWith("invalid resilient oracle price");

      // bring fallback oracle to action, but return 0 price
      await this.oracleBasement.setOracle(asset2, this.fallbackOracle.address, 2);
      await this.fallbackOracle.getUnderlyingPrice.whenCalledWith(token2).returns(0);
      // notice: token2 is invalidated
      await expect(this.oracleBasement.getUnderlyingPrice(token2)).to.be.revertedWith("invalid resilient oracle price");
    });
  });
});
