pragma solidity ^0.4.13;
import "zeppelin-solidity/contracts/ownership/Ownable.sol";
import "./oraclize/usingOraclize.sol";

contract EthToUsdOracle is Ownable, usingOraclize {

  uint public ETHUSD;
  uint public lastUpdate;
  uint public updateFrequencySeconds = 3600;
  mapping(bytes32=>bool) validIds;

  event NewOraclizeQuery(string description);
  event OraclizeQueryNotEnoughFunds(string description, uint queryPrice);
  event ETHPriceUpdated(string price, bytes proof);

  function EthToUsdOracle(bool testMode) payable {
    // This is necessary for unit tests. the address comes from `npm run oraclize`
    if (testMode) {
      OAR = OraclizeAddrResolverI(0x6f485C8BF6fc43eA212E93BBF8ce046C7f1cb475);
    }

    oraclize_setProof(proofType_TLSNotary | proofStorage_IPFS);
    update(0);
  }

  function __callback(bytes32 myid, string result, bytes proof) {
    if (!validIds[myid]) revert();
    if (msg.sender != oraclize_cbAddress()) revert();

    lastUpdate = block.timestamp;
    ETHUSD = parseInt(result, 5); // save it in storage as hundred-thousandth of a cent, e.g. $308.56893 -> 30856893
    delete validIds[myid];

    ETHPriceUpdated(result, proof);

    update(updateFrequencySeconds);
  }

  function setUpdateFrequency(uint sec) onlyOwner {
    require(sec > 0);

    updateFrequencySeconds = sec;
    update(updateFrequencySeconds);
  }

  function update(uint delay) payable {
    uint _now = block.timestamp;

    if (lastUpdate == 0 || _now - lastUpdate >= updateFrequencySeconds) {
      uint oraclizeFee = oraclize_getPrice("URL");

      if (oraclizeFee > this.balance) {
        OraclizeQueryNotEnoughFunds("Oraclize query was NOT sent, please add some ETH to cover for the query fee.", oraclizeFee);
      } else {
        NewOraclizeQuery("Oraclize query issued to get ETH price, waiting for reponse");
        bytes32 queryId = oraclize_query(delay, "URL", "json(https://api.kraken.com/0/public/Ticker?pair=ETHUSD).result.XETHZUSD.c.0");
        validIds[queryId] = true;
      }
    }
  }
}
