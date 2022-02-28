//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "./ZepToken.sol";

contract MyLittleDao is AccessControl {
    using Counters for Counters.Counter;
    bytes32 public constant BIGBROTHER = keccak256("BIGBROTHER");
    address public bigBrother;
    Counters.Counter private index;
    ZepToken public zeptoken;
    address public tokenAddress;
    uint256 public minimumQuorum;
    uint256 private debatingPeriod;
    // total funds of user
    mapping(address => uint256) private fundsByUser;
    //  user                dao number          voice       sum
    mapping(address => mapping(uint256 => mapping(bool => uint256)))
        private voices;
    // dao number               voice           summ
    mapping(uint256 => mapping(bool => uint256)) public daoFunds;
    // user             list of daos
    mapping(address => uint256[]) private votedIn;
    // list of stat
    mapping(uint256 => DaoInfo) private stat;
    struct DaoInfo {
        uint256 minimumQuorum;
        uint256 finishingAt;
        bool isOver;
        bool result;
        string info;
        address contractAddress;
        bytes _calldata;
    }

    event Voted(uint256 indexed daoId, address voter, uint256 amount);
    event NewProposal(uint256 id, string info);
    event ProposalAccepted(uint256 id, uint256 timestamp);
    event ProposalDenied(uint256 id, uint256 timestamp);
    event ProposalFailed(uint256 id, uint256 timestamp);


    constructor(address _tokenAddress, uint256 _debatingPeriod) {
        tokenAddress = _tokenAddress;
        debatingPeriod = _debatingPeriod;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        zeptoken = ZepToken(_tokenAddress);
        index.increment();
    }

    function finish(uint256 _daoId) public {
        require(!isDaoOver(_daoId), "Dao is over");
        require(
            block.timestamp >= stat[_daoId].finishingAt,
            "Timestamp is not passed yet"
        );
        if (
            (daoFunds[_daoId][true] + daoFunds[_daoId][false]) >=
            stat[_daoId].minimumQuorum
        ) {
            if (calculateWin(_daoId)) {
                // console.log("I am here =)");
                stat[_daoId].result = true;
                (bool success, bytes memory returnData) = address(
                    stat[_daoId].contractAddress
                ).call(stat[_daoId]._calldata);

                if (success) {
                    stat[_daoId].isOver = true;
                    stat[_daoId].result = true;
                    emit ProposalAccepted(_daoId, block.timestamp);

                } else {
                    emit ProposalFailed(_daoId, block.timestamp);
                }
            } else {
                // proposal denied with necessary quorum
                emit ProposalDenied(_daoId, block.timestamp);
                stat[_daoId].result = false;
                stat[_daoId].isOver = true;
            }
        } else {
            // denied without quorum
            emit ProposalDenied(_daoId, block.timestamp);
            stat[_daoId].result = false;
            stat[_daoId].isOver = true;
        }
    }

    function calculateWin(uint256 _daoId) private view returns (bool) {
        return (daoFunds[_daoId][true] >=
            ((daoFunds[_daoId][true] + daoFunds[_daoId][false]) / 100) * 51);
    }

    function isDaoOver(uint256 _daoId) public view returns (bool) {
        return stat[_daoId].isOver;
    }

    function getMyVoicesAtDao(uint _daoId) public view returns(uint256 _for,uint256 _against){
        _for = voices[msg.sender][_daoId][true];
        _against = voices[msg.sender][_daoId][false];
        return (_for,_against);
    }

    function addProposal(
        string memory _info,
        address _contractAddress,
        bytes memory _calldata
    ) public {
        // check rights
        require(hasRole(BIGBROTHER, msg.sender), "Unauthorised");
        minimumQuorum = (zeptoken.totalSupply() * 3) / 10;
        stat[index.current()] = DaoInfo(
            minimumQuorum,
            block.timestamp + debatingPeriod,
            false,
            false,
            _info,
            _contractAddress,
            _calldata
        );
        emit NewProposal(index.current(), _info);
        index.increment();
    }

    function getProposalInfo(uint256 _daoId)
        public
        view
        returns (string memory)
    {
        return stat[_daoId].info;
    }

    function vote(
        uint256 _daoId,
        bool _decision,
        uint256 _amount
    ) public {
        require(!isDaoOver(_daoId), "Dao is over");

        require(
            block.timestamp < stat[_daoId].finishingAt,
            "Dao is over but not finished"
        );
        require(
            fundsByUser[msg.sender] >=
                (voices[msg.sender][_daoId][!_decision] + _amount),
            "Not enough deposited funds"
        );
        require(
            _amount > (voices[msg.sender][_daoId][_decision]),
            "Too little amount"
        );

        // write voice to user stat
        voices[msg.sender][_daoId][_decision] = _amount;
        // write voice to dao stat
        daoFunds[_daoId][_decision] += _amount;
        // write dao to user's list
        votedIn[msg.sender].push(_daoId);
        emit Voted(_daoId, msg.sender, _amount);
    }

    function deposit(uint256 _amountInWei) public {
        zeptoken.transferFrom(msg.sender, address(this), _amountInWei);
        fundsByUser[msg.sender] += _amountInWei;
    }

    function withdraw(uint256 _amount) public {
        require(fundsByUser[msg.sender] >= _amount, "Amount is too large");
        // check that funds are not frosen
        require(
            fundsByUser[msg.sender] - checkFrosen(msg.sender) >= _amount,
            "Something is frosen, check it"
        );
        zeptoken.transfer(msg.sender, _amount);
        fundsByUser[msg.sender] -= _amount;
    }

    function checkFrosen(address _of) public view returns (uint256) {
        if (votedIn[_of].length == 0) {
            return 0;
        }
        uint256 frosenSumm;
        // iterate over voted daos

        for (
            uint256 daoIndex = 1;
            daoIndex < index.current();
            daoIndex++
        ) {
            if (
                !stat[daoIndex].isOver &&
                (voices[_of][daoIndex][true] > 0 ||
                    voices[_of][daoIndex][false] > 0)
            ) {
                uint256 summ = returnBiggestOf(
                    voices[_of][daoIndex][true],
                    voices[_of][daoIndex][false]
                );
                frosenSumm = returnBiggestOf(frosenSumm, summ);
            }
        }
        return frosenSumm;
    }

    function returnBiggestOf(uint256 a, uint256 b)
        private
        pure
        returns (uint256)
    {
        return a > b ? a : b;
    }


}
