var config = function() {
    this.faucetAddress = "<your faucet address here>";
    this.smsAmount = 5e18; 						// 5 ETH
    this.emailAmount = 5e18;
    this.refillPeriod = 24 * 3600 * 1000; 		// 24h
    this.bcExplorer = "https://kovan.etherscan.io/tx/";
    this.port = 80;

    this.lazy=true;				// set me to false once you setup the values above
}

module.exports = config;
