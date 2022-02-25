import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, Bytes, BytesLike, Contract, ContractFactory} from "ethers";
import { ethers } from "hardhat";

describe("MyLittleDao", function () {
  let 
    BIGBROTHER:BytesLike,
    owner:SignerWithAddress,
    alice:SignerWithAddress,
    bob:SignerWithAddress,
    chairman:SignerWithAddress,
    daoFactory: ContractFactory,
    BNCBridge: ContractFactory,
    ethTokenFactory: ContractFactory,
    dao: Contract,
    token: Contract,
    ethToken: Contract,
    bncToken: Contract,
    KCNC:string,
    tokenOwner:Contract,
    daoOwner:Contract,
    amountToTransfer=ethers.utils.parseEther("100"),
    debatingPeriod=3000
    
  before(async () => {
    [owner,alice,bob,chairman] = await  ethers.getSigners();
    daoFactory = await ethers.getContractFactory("MyLittleDao",owner);
    ethTokenFactory = await ethers.getContractFactory("ZepToken");
  }); 
  beforeEach(async () => {
    token = await ethTokenFactory.deploy(ethers.utils.parseEther("100000"));
    await token.deployed();
    dao = await daoFactory.deploy(token.address, debatingPeriod);
    await dao.deployed();
    tokenOwner = token.connect(owner);
    daoOwner = dao.connect(owner);

    BIGBROTHER = await dao.BIGBROTHER(); 
  });
  describe("Should test", async function () {
    

    async function DAOgrantRole() {
      await daoOwner.grantRole(BIGBROTHER,chairman.address);
    }
    async function DAOaddProposal() {
      await daoOwner.grantRole(BIGBROTHER,chairman.address);
    }
    it("Should grant BIGBROTHER role", async function () {
      await DAOgrantRole();
      expect(await dao.hasRole(BIGBROTHER,chairman.address)).to.eq(true);
    });
    it("Should add proposal and get info", async function () {
      let 
        encodedTx = token.interface.encodeFunctionData("transferFrom",[owner.address,alice.address,amountToTransfer]),
        data = ["https://ya.ru/", token.address,encodedTx];

      await expect(dao.connect(chairman).addProposal(data[0],data[1],data[2])).to.be.revertedWith("Unauthorised");
      await expect(dao.connect(owner).addProposal(data[0],data[1],data[2])).to.be.revertedWith("Unauthorised");
      await expect(dao.connect(alice).addProposal(data[0],data[1],data[2])).to.be.revertedWith("Unauthorised");

      await DAOgrantRole();
      
      await dao.connect(chairman).addProposal(data[0],data[1],data[2]);
      await dao.getProposalInfo(1)
    });
    it("Should deposit and withdraw without proposal", async function () {
      const depositSumm = ethers.utils.parseEther("30000");


      await token.connect(owner).transfer(alice.address,depositSumm);
      await token.connect(owner).transfer(bob.address,depositSumm);

      await token.connect(alice).approve(dao.address,depositSumm);
      await token.connect(bob).approve(dao.address,depositSumm);

      await expect(dao.connect(alice).withdraw(1)).to.be.revertedWith("Amount is too large");

      await dao.connect(alice).deposit(depositSumm);
      await dao.connect(bob).deposit(depositSumm.div(3)); //10000 tokens

      expect(await token.balanceOf(alice.address)).to.eq(0);
      expect(await token.balanceOf(bob.address)).to.eq(ethers.utils.parseEther("20000"));

      await dao.connect(alice).withdraw(depositSumm);
      await dao.connect(bob).withdraw(depositSumm.div(3)); //10000 tokens

      expect(await token.balanceOf(alice.address)).to.eq(depositSumm);
      expect(await token.balanceOf(bob.address)).to.eq(depositSumm);

    });
  });
  describe("Should test", async function () {
    it("Should add proposal and apply it", async function () {
      // preparation
      const depositSumm = ethers.utils.parseEther("30000");
      await token.connect(owner).transfer(alice.address,depositSumm);
      await token.connect(owner).transfer(bob.address,depositSumm);
      await token.connect(alice).approve(dao.address,depositSumm);
      await token.connect(bob).approve(dao.address,depositSumm);
      await dao.connect(alice).deposit(depositSumm);
      await dao.connect(bob).deposit(depositSumm); //15000 tokens

      await daoOwner.grantRole(BIGBROTHER,chairman.address);
      // tx preparation
      const encodedTx = token.interface.encodeFunctionData("transferFrom",[
        owner.address,alice.address,amountToTransfer
      ]);
      // console.log("encoded ", encodedTx)
      
      const data = ["https://ya.ru/", token.address,encodedTx];
      // add proposal
      await dao.connect(chairman).addProposal(data[0],data[1],data[2]); //TODO check event
      // vote against
      await dao.connect(alice).vote(1,false,depositSumm.sub(ethers.utils.parseEther("5000")));
      // vote for
      await dao.connect(bob).vote(1,true,depositSumm);
      // try to finish
      await expect(daoOwner.finish(1)).to.be.revertedWith("Timestamp is not passed yet");
      async function passMinutes(time:number) {
        await ethers.provider.send('evm_increaseTime', [time*60]);
        await ethers.provider.send("evm_mine",[]);
        console.log("                  ("+time+" minutes passed)");
      }
      // pass minutes to finish
      await passMinutes(600);

      let beforeBalance:BigNumber = await token.balanceOf(alice.address);
      // try again
      await expect(dao.connect(alice).finish(1)).to.emit(dao,"ProposalFailed");
      // fairplay enabled
      await token.connect(owner).approve(alice.address,ethers.utils.parseEther("100000"));
      await token.connect(owner).approve(dao.address,ethers.utils.parseEther("100000"));
      // try again
      await expect(dao.connect(alice).finish(1)).to.emit(dao,"ProposalAccepted");
      // await passMinutes(1);
      let afterBalance:BigNumber = await token.balanceOf(alice.address);
      expect(await afterBalance.sub(amountToTransfer)).to.eq(beforeBalance);
      // try to finish twice
      await expect(dao.connect(alice).finish(1)).to.be.revertedWith("Dao is over");
      await expect(dao.connect(bob).finish(1)).to.be.revertedWith("Dao is over");
      await expect(dao.connect(owner).finish(1)).to.be.revertedWith("Dao is over");
      await expect(dao.connect(chairman).finish(1)).to.be.revertedWith("Dao is over");
    });
    it("Should add proposal and deny it, try to vote", async function () {
      // preparation
      const depositSumm = ethers.utils.parseEther("30000");
      await token.connect(owner).transfer(alice.address,depositSumm);
      await token.connect(owner).transfer(bob.address,depositSumm);
      await token.connect(alice).approve(dao.address,depositSumm);
      await token.connect(bob).approve(dao.address,depositSumm);
      await dao.connect(alice).deposit(depositSumm);
      await dao.connect(bob).deposit(depositSumm); //15000 tokens
      await token.connect(owner).approve(alice.address,ethers.utils.parseEther("100000"));
      await token.connect(owner).approve(dao.address,ethers.utils.parseEther("100000"));
      await daoOwner.grantRole(BIGBROTHER,chairman.address);
      // tx preparation
      const encodedTx = token.interface.encodeFunctionData("transferFrom",[
        owner.address,alice.address,amountToTransfer
      ]);   
      const data = ["https://ya.ru/", token.address,encodedTx];
      // add proposal
      await dao.connect(chairman).addProposal(data[0],data[1],data[2]); //TODO check event
      // vote against
      await dao.connect(alice).vote(1,false,depositSumm);
      // try to vote without necessary funds
      await expect(dao.connect(alice).vote(1,false,depositSumm.mul(2))).to.be.revertedWith("Not enough deposited funds");
      // vote for
      await dao.connect(bob).vote(1,true,depositSumm.sub(ethers.utils.parseEther("5000")));
      // try to vote with less funds
      await expect(dao.connect(bob).vote(1,true,depositSumm.sub(ethers.utils.parseEther("6000")))).to.be.revertedWith("Too little amount");

      // try to finish
      await expect(daoOwner.finish(1)).to.be.revertedWith("Timestamp is not passed yet");
      async function passMinutes(time:number) {
        await ethers.provider.send('evm_increaseTime', [time*60]);
        await ethers.provider.send("evm_mine",[]);
        console.log("                  ("+time+" minutes passed)");
      }
      // pass minutes to finish
      await passMinutes(600);
      // try to vote after time passed
      await expect(dao.connect(alice).vote(1,false,depositSumm.div("100"))).to.be.revertedWith("Dao is over but not finished");

      let beforeBalance:BigNumber = await token.balanceOf(alice.address);
      await expect(dao.connect(alice).finish(1)).to.emit(dao,"ProposalDenied");
      
      expect(await token.balanceOf(alice.address)).to.eq(beforeBalance);
      // await passMinutes(1); -----------------
      // vote after finish
      await expect(dao.connect(alice).vote(1,false,depositSumm.div("100"))).to.be.revertedWith("Dao is over");

      // try to finish twice
      await expect(dao.connect(alice).finish(1)).to.be.revertedWith("Dao is over");
      await expect(dao.connect(bob).finish(1)).to.be.revertedWith("Dao is over");
      await expect(dao.connect(owner).finish(1)).to.be.revertedWith("Dao is over");
      await expect(dao.connect(chairman).finish(1)).to.be.revertedWith("Dao is over");
    });
    it("Should add proposal without necessary quorum", async function () {
      // preparation
      const depositSumm = ethers.utils.parseEther("30000");
      await token.connect(owner).transfer(alice.address,depositSumm);
      await token.connect(owner).transfer(bob.address,depositSumm);
      await token.connect(alice).approve(dao.address,depositSumm);
      await token.connect(bob).approve(dao.address,depositSumm);
      await dao.connect(alice).deposit(depositSumm);
      await dao.connect(bob).deposit(depositSumm); //15000 tokens
      await token.connect(owner).approve(alice.address,ethers.utils.parseEther("100000"));
      await token.connect(owner).approve(dao.address,ethers.utils.parseEther("100000"));
      await daoOwner.grantRole(BIGBROTHER,chairman.address);
      // tx preparation
      const encodedTx = token.interface.encodeFunctionData("transferFrom",[
        owner.address,alice.address,amountToTransfer
      ]);   
      const data = ["https://ya.ru/", token.address,encodedTx];
      // add proposal
      await dao.connect(chairman).addProposal(data[0],data[1],data[2]); //TODO check event
      // vote against
      await dao.connect(alice).vote(1,false,depositSumm.div("10"));
      // try to withdraw
      await expect(dao.connect(alice).withdraw(depositSumm)).to.be.revertedWith("Something is frosen, check it");
      console.log(await dao.checkFrosen(alice.address)," is frosen");
      // vote for
      await dao.connect(bob).vote(1,true,depositSumm.sub(ethers.utils.parseEther("5000")));
      // try to finish
      await expect(daoOwner.finish(1)).to.be.revertedWith("Timestamp is not passed yet");
      async function passMinutes(time:number) {
        await ethers.provider.send('evm_increaseTime', [time*60]);
        await ethers.provider.send("evm_mine",[]);
        console.log("                  ("+time+" minutes passed)");
      }
      // pass minutes to finish
      await passMinutes(600);

      let beforeBalance:BigNumber = await token.balanceOf(alice.address);
      await expect(dao.connect(alice).finish(1)).to.emit(dao,"ProposalDenied");
      expect(await token.balanceOf(alice.address)).to.eq(beforeBalance);
      // await passMinutes(1);
      // try to finish twice
      await expect(dao.connect(alice).finish(1)).to.be.revertedWith("Dao is over");
      await expect(dao.connect(bob).finish(1)).to.be.revertedWith("Dao is over");
      await expect(dao.connect(owner).finish(1)).to.be.revertedWith("Dao is over");
      await expect(dao.connect(chairman).finish(1)).to.be.revertedWith("Dao is over");
    });
    it("Should add proposals and check withdraw", async function () {
      // preparation
      const depositSumm = ethers.utils.parseEther("30000");
      await token.connect(owner).transfer(alice.address,depositSumm);
      await token.connect(owner).transfer(bob.address,depositSumm);
      await token.connect(alice).approve(dao.address,depositSumm);
      await token.connect(bob).approve(dao.address,depositSumm);
      await dao.connect(alice).deposit(depositSumm);
      await dao.connect(bob).deposit(depositSumm); //15000 tokens
      await token.connect(owner).approve(alice.address,ethers.utils.parseEther("100000"));
      await token.connect(owner).approve(dao.address,ethers.utils.parseEther("100000"));
      await daoOwner.grantRole(BIGBROTHER,chairman.address);
      // tx preparation
      const encodedTx = token.interface.encodeFunctionData("transferFrom",[
        owner.address,alice.address,amountToTransfer
      ]);   
      const data = ["https://ya.ru/", token.address,encodedTx];
      // add  1  proposal and vote
      await dao.connect(chairman).addProposal(data[0],data[1],data[2]); //TODO check event
      await dao.connect(alice).vote(1,false,depositSumm.div("10"));
      await dao.connect(alice).vote(1,true,depositSumm.div("7"));
      async function passMinutes(time:number) {
        await ethers.provider.send('evm_increaseTime', [time*60]);
        await ethers.provider.send("evm_mine",[]);
        console.log("                  ("+time+" minutes passed)");
      }
      // pass minutes to finish
      await passMinutes(600);
      // add  2  proposal and vote
      await dao.connect(chairman).addProposal(data[0],data[1],data[2]); //TODO check event
      await dao.connect(alice).vote(2,true,depositSumm.div("10"));
      await dao.connect(alice).vote(2,false,depositSumm.div("3"));
      // add 3 proposal
      await dao.connect(chairman).addProposal(data[0],data[1],data[2]); //TODO check event

      // check frosen
      expect(await dao.checkFrosen(alice.address)).to.eq(depositSumm.div("3"));
      // check voices at dao
      let voices:BigNumber[] = await dao.connect(alice).getMyVoicesAtDao(2);
      expect(await voices[0]).to.eq(depositSumm.div("10"));
      expect(await voices[1]).to.eq(depositSumm.div("3"));

    });
  });
});