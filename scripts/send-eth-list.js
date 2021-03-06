const commandLineArgs = require('command-line-args');
const getUsage = require('command-line-usage');
const fs = require("fs");
const _ = require("lodash");
const Parallel = require("async-parallel");

const optionsDefs = [
  { name: "help", alias: "h", type: Boolean, description: "Print this usage guide." },
  { name: "network", type: String, description: "The blockchain that you wish to use. Valid options are `testrpc`, `rinkeby`, `mainnet`." },
  { name: "csv", type: String, description: "(optional) The CSV file to write the ledger report" },
  { name: "gasPriceGwei", type: Number, description: "The gas price in units of gwei" },
  { name: "concurrency", alias: "c", type: Number, description: "(Optional) The number of concurrent transactions to submit to the network at any one time. The default concurrency is 100 simultaneous transactions at a time." },
];

const usage = [
  {
    header: "send-eth-list",
    content: "This script send ETH to recipients from a CSV of addresses and amounts"
  },{
    header: "Options",
    optionList: optionsDefs
  }
];

module.exports = async function(callback) {
  const options = commandLineArgs(optionsDefs);
  if (!process.env.WALLET) {
    console.log("WALLET environment variable is not set. Please set the WALLET env variable to the address that ETH will be sent from");
    callback();
    return;
  }

  if (!options.csv || !options.network || options.help) {
    console.log(getUsage(usage));
    callback();
    return;
  }
  let { csv, concurrency, gasPriceGwei } = options;

  concurrency = concurrency || 100;

  let fileStr = fs.readFileSync(csv);
  let rows = _.compact(fileStr.toString().split("\n"));

  console.log(`Scheduling ${rows.length} addresses to be sent ETH`);

  let counter = 0;
  await Parallel.each(rows, async row => {
    let count = ++counter;
    if (count % concurrency === 0) {
      console.log(`Processing ${count} of ${rows.length}, ${Math.round((count / rows.length) * 100)}% complete...`);
    }

    let [ address, amount ] = row.replace(/"/g, "").split(",");

    if (address && amount && amount.trim()) {
      let wei = web3.toWei(amount, "ether");
      let options = {
        from: process.env.WALLET,
        to: address,
        value: wei
      };
      if (gasPriceGwei) {
        options.gasPrice = web3.toWei(gasPriceGwei, 'gwei');
      }
      console.log(`Sending ${address} wei ${wei}`);
      try {
        await web3.eth.sendTransaction(options);
      } catch (err) {
        console.error(`Error sending ETH ${address}, ${err.message}`);
      }
    }
  }, concurrency);

  console.log("done.");
};
