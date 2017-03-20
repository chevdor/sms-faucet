'use strict';

const Parity = require('@parity/parity.js');
const oo7_parity = require('oo7-parity');
var config = new(require('./config.js'))();

function setupAbi(url) {
    const transport = new Parity.Api.Transport.Http(url);
    var api = new Parity.Api(transport);
    api.abi = oo7_parity.abiPolyfill(api);
    let bonds = oo7_parity.setupBonds(api);
    return [api, bonds];
}

let [apiF, bondsF] = setupAbi(config.mainnet);
let [apiK, bondsK] = setupAbi(config.kovan);

bondsF.netChain.then(c => console.log(`On network chain ${c}`));

var express = require('express');
var cors = require('cors');
var bodyParser = require('body-parser');
var keccak_256 = require('js-sha3').keccak_256;

// if (config.lazy) {
//     console.err('How about filling up the config first?');
//     process.exit(1);
// }

var app = express();
var morgan = require('morgan')
app.set('view engine', 'ejs');
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// app.use(morgan('combined'))


// TODO!!! UPDATE registry ABI in oo7-parity.js

const BadgeABI = [{ "constant": true, "inputs": [{ "name": "_who", "type": "address" }, { "name": "_field", "type": "string" }], "name": "getData", "outputs": [{ "name": "", "type": "bytes32" }], "payable": false, "type": "function" }, { "constant": true, "inputs": [{ "name": "_who", "type": "address" }, { "name": "_field", "type": "string" }], "name": "getAddress", "outputs": [{ "name": "", "type": "address" }], "payable": false, "type": "function" }, { "constant": true, "inputs": [{ "name": "_who", "type": "address" }, { "name": "_field", "type": "string" }], "name": "getUint", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "type": "function" }, { "constant": true, "inputs": [{ "name": "_who", "type": "address" }], "name": "certified", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "type": "function" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "who", "type": "address" }], "name": "Confirmed", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "who", "type": "address" }], "name": "Revoked", "type": "event" }];
let sms = bondsF.makeContract(bondsF.registry.lookupAddress('smsverification', 'A'), BadgeABI);
let email = bondsF.makeContract(bondsF.registry.lookupAddress('emailverification', 'A'), BadgeABI);

let banned = {};

let past = {};

const ETH_SMS = config.smsAmount;
const ETH_EMAIL = config.emailAmount;
const REFILL_PERIOD = config.refillPeriod;

function rain(who, to) {
    return new Promise(function(resolve, reject) {

        if (!who.match(/^0x[a-f0-9]{40}$/) || !to.match(/^0x[a-f0-9]{40}$/)) {
            return reject('Invalid address.');
        }

        if (banned[who]) {
            return reject('Account banned.');
        }

        if (past[who] && Date.now() - past[who] < REFILL_PERIOD) {
            return reject('Faucet draw rate limited. Call back in ' + parseInt(config.refillPeriod) / 3600000 + ' hours.');
        }

        bondsF.Transform
            .all([sms.certified(who), email.certified(who)])
            .then(([smscert, emailcert]) => {
                if (!smscert && !emailcert) {
                    return reject('Account not certified');
                }

                past[who] = Date.now();
                apiK.eth
                    .sendTransaction({ from: config.faucetAddress, to: to, value: (smscert ? ETH_SMS : 0) + (emailcert ? ETH_EMAIL : 0) })
                    .then(tx => resolve({ result: 'Kovan Ether on its way in transaction', tx: tx }))
                    .catch(e => reject(`Internal error: ${JSON.stringify(e)}`));
            });
    });
}


app.get('/', function(req, res) {
    res.render('pages/index');
});

app.get('/about', function(req, res) {
    res.render('pages/about');
});

app.post('/api/addr', function(req, res) {
    console.log(req);
    let who = req.params.address.toLowerCase();
    rain(who, who)
        .then(function(response) {
            res.json(response);
        })
        .catch(function(error) {
            res.json({ error: error });
        });
});

app.get('/addr/:address', function(req, res) {
    let who = req.params.address.toLowerCase();
    rain(who, who)
        .then(function(response) {
            res.end(`${response.result} ${config.bcExplorer}${response.tx}`);
        })
        .catch(function(error) {
            res.end(error);
        });
});
/*
app.get('/:address/:to', function (req, res) {
    let who = req.params.address.toLowerCase();
    let to = req.params.to.toLowerCase();
    rain(who, to, res);
});
*/

console.log("Start server...");
var server = app.listen(process.env.PORT || config.port, function() {
    var host = server.address().address;
    var port = server.address().port;
    console.log("sms-faucet service listening at http://%s:%s", host, port);
});
