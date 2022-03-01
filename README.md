# Simple Dao for EVM chains
Deployed and verified at 
https://rinkeby.etherscan.io/address/0x8aa92B98fD6897087fF5ceF95522cF1b0F73dE3B#code
## How it works
Account with BIGBROTHER role can start a voting.
Anyone can deposit determined ERC20 tokens to vote for or against.
Voting is succeed required minimumQuorum, debatingPeriod and 51% votes for suggestion, otherwise it will cancel. In case of success, anyone can run function using calldata.