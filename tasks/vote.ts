import { task } from "hardhat/config";

task("vote", "Vote for proposal")
    .addParam("amount", "amount to depoit (in ether)")
    .addParam("daoId","just dao ID")
    .addParam("for","1 to true, 0 to false")
    .setAction(async (taskArgs, hre) => {
        const dao = await hre.ethers.getContractAt("MyLittleDao", "0x8aa92B98fD6897087fF5ceF95522cF1b0F73dE3B");
        const token = await hre.ethers.getContractAt("ZepToken","0x58f1AC6D806e4F15064B61B118e7514cFade6ceC");
        const [me] = await hre.ethers.getSigners();
        // await token.connect(me).approve
        if (String(taskArgs.for) == "1"){
            await dao.vote(taskArgs.daoId,true,taskArgs.amount);
        } else{
            await dao.vote(taskArgs.daoId,false,taskArgs.amount);
        }
        console.log("success");
    });