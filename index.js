console.log('starting order book');

const express = require('express');
const http = require('http');
const https = require('https');
const reverse = require('lodash/reverse');
const sortBy = require('lodash/sortBy');
const cloneDeep = require('lodash/cloneDeep');
const path = require('path');
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

const PORT = process.env.PORT || 5000;

// round to eight decimals max
function roundToEightMax(num) {
    return +(Math.round(num + "e+8")  + "e-8");
}

const getJSON = function(options, currency) {
    const formattedOptions = cloneDeep(options);
    delete formattedOptions.path;
    formattedOptions.path = options.path.replace('{CURRENCY}', currency);
    return new Promise(resolve => {
        console.log('fetching ' + formattedOptions.host);
        const port = formattedOptions.port == 443 ? https : http;
        const req = port.request(formattedOptions, function(res) {
            let output = '';
            console.log(formattedOptions.host + ':' + res.statusCode);
            res.setEncoding('utf8');

            res.on('data', function (chunk) {
                output += chunk;
            });

            res.on('end', function() {
                const obj = JSON.parse(output);
                resolve(obj);
            });
        });

        req.on('error', function(err) {
            console.log(err);
        });

        req.end();
    });
};

const bittrexOptions = {
    host: 'bittrex.com',
    port: 443,
    path: '/api/v1.1/public/getorderbook?market=BTC-{CURRENCY}&type=both',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

const poloniexOptions = {
    host: 'poloniex.com',
    port: 443,
    path: '/public?command=returnOrderBook&currencyPair=BTC_{CURRENCY}&depth=1000',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

const binanceOptions = {
    host: 'api.binance.com',
    port: 443,
    path: '/api/v1/depth?limit=1000&symbol={CURRENCY}BTC',
    method: 'GET',
    headers: {
        'Content-Type': 'application/json'
    }
};

async function fetchBooks(currency) {
    try {
        const bittrexBook = await getJSON(bittrexOptions, currency);
        const poloniexBook = await getJSON(poloniexOptions, currency);
        const binanceBook = await getJSON(binanceOptions, currency);
        return [bittrexBook, poloniexBook, binanceBook];
    } catch (error) {
        console.error(error);
    }
}

const getBooks = function(currency) {
    return new Promise(resolve => {
        fetchBooks(currency).then((result) => {
            const bittrexBook = result[0];
            const poloniexBook = result[1];
            const binanceBook = result[2];
            const bittrexBids = bittrexBook.result.buy;
            const bittrexAsks = bittrexBook.result.sell;
            const poloniexBids = poloniexBook.bids;
            const poloniexAsks = poloniexBook.asks;
            const binanceBids = binanceBook.bids;
            const binanceAsks = binanceBook.asks;
            const bids = {};
            const asks = {};

            bittrexBids.forEach(function(item) {
                bids[item.Rate] = {
                    bittrex: item.Quantity,
                    total: item.Quantity
                }
            });

            bittrexAsks.forEach(function(item) {
                asks[item.Rate] = {
                    bittrex: item.Quantity,
                    total: item.Quantity
                }
            });

            poloniexBids.forEach(function(item) {
                if (bids[item[0]]) {
                    bids[item[0]]['poloniex'] = item[1];
                    bids[item[0]]['total'] = bids[item[0]]['total'] + item[1];
                } else {
                    bids[item[0]] = {
                        poloniex: item[1],
                        total: item[1]
                    }
                }
            });

            poloniexAsks.forEach(function(item) {
                if (asks[item[0]]) {
                    asks[item[0]]['poloniex'] = item[1];
                    asks[item[0]]['total'] = asks[item[0]]['total'] + item[1];
                } else {
                    asks[item[0]] = {
                        poloniex: item[1],
                        total: item[1]
                    }
                }
            });

            binanceBids.forEach(function(item) {
                if (bids[item[0]]) {
                    bids[item[0]]['binance'] = Number(item[1]);
                    bids[item[0]]['total'] = bids[item[0]]['total'] + Number(item[1]);
                } else {
                    bids[item[0]] = {
                        binance: Number(item[1]),
                        total: Number(item[1])
                    }
                }
            });

            binanceAsks.forEach(function(item) {
                if (asks[item[0]]) {
                    asks[item[0]]['binance'] = Number(item[1]);
                    asks[item[0]]['total'] = asks[item[0]]['total'] + Number(item[1]);
                } else {
                    asks[item[0]] = {
                        binance: Number(item[1]),
                        total: Number(item[1])
                    }
                }
            });

            // calculate totals
            const formattedBids = [];
            const formattedAsks = [];

            for (const key in bids) {
                formattedBids.push({
                    rate: key,
                    poloniex: bids[key].poloniex ? bids[key].poloniex : '0',
                    bittrex: bids[key].bittrex ? bids[key].bittrex : '0',
                    binance: bids[key].binance ? bids[key].binance : '0',
                    total: bids[key].total
                });
            }

            for (const key in asks) {
                formattedAsks.push({
                    rate: key,
                    poloniex: asks[key].poloniex ? asks[key].poloniex : '0',
                    bittrex:  asks[key].bittrex ? asks[key].bittrex : '0',
                    binance: asks[key].binance ? asks[key].binance : '0',
                    total: asks[key].total
                });
            }

            // sort appropriately
            const sortedBids = reverse(sortBy(formattedBids, ['rate']));
            const sortedAsks = sortBy(formattedAsks, ['rate']);

            // calculate depth
            let bidDepth = 0;
            let askDepth = 0;
            const bidsWithDepth = [];
            const asksWithDepth = [];
            const highestBid = sortedBids[0].rate;
            const lowestAsk = sortedAsks[0].rate;

            sortedBids.forEach(function(item) {
                bidDepth += item.total;
                bidDepth = roundToEightMax(bidDepth);
                item.depth = bidDepth;
                if (item.rate > lowestAsk) {
                    item.arbitrage = 'true';
                }
                bidsWithDepth.push(item);
            });

            sortedAsks.forEach(function(item) {
                askDepth += item.total;
                askDepth = roundToEightMax(askDepth);
                item.depth = askDepth;
                if (item.rate < highestBid) {
                    item.arbitrage = 'true';
                }
                asksWithDepth.push(item);
            });

            resolve({
                bids: bidsWithDepth,
                asks: asksWithDepth
            });
        });
    });
};

// Multi-process to utilize all CPU cores
if (cluster.isMaster) {
    console.error(`Node cluster master ${process.pid} is running`);

    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.error(`Node cluster worker ${worker.process.pid} exited: code ${code}, signal ${signal}`);
    });

} else {
    const app = express();

    app.use(express.static(path.resolve(__dirname + '/client/build')));

    // Answer API requests
    app.get('/api', function (req, res) {
        const url = req.url;
        const currency = url.replace('/api?currency=', '');
        getBooks(currency).then((result) => {
            res.writeHead(200, {'Content-Type': 'text/plain'});
            res.end(JSON.stringify(result));
        });
    });

    // All remaining requests return the React app, so it can handle routing.
    app.get('*', function(request, response) {
        response.sendFile(path.resolve(__dirname + '/client/build', 'index.html'));
    });

    app.listen(PORT, function () {
        console.error(`Node cluster worker ${process.pid}: listening on port ${PORT}`);
    });
}
