import { ethers } from "hardhat";

async function main() {
  const daoFactory = await ethers.getContractFactory("MyLittleDao");
  const tokenAddress = "0x58f1AC6D806e4F15064B61B118e7514cFade6ceC";
  const debatingPeriod = 6000;
  const token = await ethers.getContractAt("ZepToken",tokenAddress);
  const dao = await daoFactory.deploy(token.address,debatingPeriod);
  await dao.deployed();

  console.log("MyLittleDao deployed to:", dao.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
