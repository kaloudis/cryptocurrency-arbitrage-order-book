import React, { Component } from 'react';
import './App.css';
import axios from 'axios';
import ReactTable from 'react-table';
import 'react-table/react-table.css';
import Button from '@material-ui/core/Button';
import LinearProgress from '@material-ui/core/LinearProgress';
import Icon from '@material-ui/core/Icon';

class App extends Component {
    constructor() {
        super();
        this.state = {
            currency: 'ETH',
            refreshRate: 60,
            bids: {},
            asks: {},
            loading: false
        }
    }

    changePair(currency) {
        const { refreshRate } = this.state;
        clearInterval(this.interval);

        this.setState({
            currency: currency
        });

        this.fetchBooks(currency);
        this.interval = setInterval(() => this.fetchBooks(currency), refreshRate * 1000);
    }

    fetchBooks(currency) {
        this.setState({
            loading: true
        });

        const url = '/api?currency=' + currency;
        axios.get(url)
        .then((response) => {
            const bids = response.data.bids;
            const asks = response.data.asks;

            this.setState({
                bids: bids,
                asks: asks,
                loading: false
            });
        })
        .catch((error) => {
            console.log(error);
        });
    }

    componentDidMount() {
        const { currency, refreshRate } = this.state;
        this.fetchBooks(currency);
        this.interval = setInterval(() => this.fetchBooks(currency), refreshRate * 1000);
    }

    componentWillUnmount() {
        clearInterval(this.interval);
    }

    changeRefreshRate() {
        const { refreshRate, currency } = this.state;
        clearInterval(this.interval);

        let newRate;
        switch(refreshRate) {
            case 30:
                newRate = 60;
                break;
            case 60:
                newRate = 120;
                break;
            case 120:
                newRate = 300;
                break;
            case 300:
                newRate = 15;
                break;
            case 15:
            default:
                newRate = 30;
                break;
        }

        this.setState({
            refreshRate: newRate
        });

        this.interval = setInterval(() => this.fetchBooks(currency), newRate * 1000);
    }

    render() {
        const { bids, asks, currency, loading, refreshRate } = this.state;

        return (
            <div className="App">
                <header className="App-header">
                    <p>
                        {currency}/BTC Order Book
                    </p>
                    <div className="buttons">
                        <Button variant="contained" color="default" onClick={() => this.changePair('ETH')}>
                            ETH/BTC
                        </Button>
                        <Button variant="contained" color="secondary" onClick={() => this.changePair('ZEC')}>
                            ZEC/BTC
                        </Button>
                        <Button variant="contained" color="inherit" style={{ backgroundColor: '#FAB57F', color: 'black' }} onClick={() => this.changePair('XMR')}>
                            XMR/BTC
                        </Button>
                        <Button variant="contained" color="inherit" style={{ backgroundColor: '#F3E5AB', color: 'black' }} onClick={() => this.changePair('LTC')}>
                            LTC/BTC
                        </Button>
                    </div>
                    <div className="buttons">
                        <Button variant="contained" color="primary" size="small" onClick={() => this.changeRefreshRate()}>
                            {loading ? "Loading" : <div><Icon style={{ fontSize: 12 }}>sync</Icon>  {refreshRate / 60} m</div>}
                        </Button>
                    </div>
                </header>
                {loading && <LinearProgress />}
                <div style={{ width: '50%', float: 'left'}}>
                    <p>Asks</p>
                    {asks.length > 0 && <ReactTable
                        data={asks}
                        columns={[
                            {
                                id: "rate",
                                Header: "Rate",
                                accessor: d => d.rate
                            },
                            {
                                id: "total",
                                Header: "Quantity",
                                accessor: d => d.total
                            },
                            {
                                id: "depth",
                                Header: "Depth",
                                accessor: d => d.depth
                            },
                            {
                                id: "arbitrage",
                                Header: "Arbitrage Opp.",
                                accessor: d => d.arbitrage,
                                Cell: row => {
                                    if (row.original.arbitrage) {
                                        return (
                                            <div
                                                style={{
                                                    width: '100%',
                                                    height: '100%'
                                                }}
                                            >
                                                <Icon fontSize="small">star</Icon>
                                            </div>
                                        );
                                    }
                                }
                            }
                        ]}
                        SubComponent={row => {
                            return (
                                <div style={{ paddingTop: 10, paddingBottom: 15 }}>
                                    <div><i>Order Quantity by Exchange</i></div>
                                    <table style={{ width: '100%', backgroundColor: 'light-grey' }}>
                                        <tbody>
                                           <tr>
                                               <th style={{ backgroundColor: '#D3D3D3' }}>Exchange</th>
                                               <th style={{ backgroundColor: '#D3D3D3' }}>Quantity</th>
                                           </tr>
                                           <tr>
                                               <td style={{ backgroundColor: '#88C8FC' }}>Bittrex</td>
                                               <td>{row.original.bittrex}</td>
                                           </tr>
                                           <tr>
                                               <td style={{ backgroundColor: '#07ED85' }}>Poloniex</td>
                                               <td>{row.original.poloniex}</td>
                                           </tr>
                                           <tr>
                                               <td style={{ backgroundColor: '#F3BA2E' }}>Binance</td>
                                               <td>{row.original.binance}</td>
                                           </tr>
                                       </tbody>
                                    </table>
                                </div>
                            );
                        }}
                    />}
                </div>
                <div style={{ width: '50%', float: 'right'}}>
                    <p>Bids</p>
                    {bids.length > 0 && <ReactTable
                        data={bids}
                        columns={[
                            {
                                id: "rate",
                                Header: "Rate",
                                accessor: d => d.rate
                            },
                            {
                                id: "total",
                                Header: "Quantity",
                                accessor: d => d.total
                            },
                            {
                                id: "depth",
                                Header: "Depth",
                                accessor: d => d.depth
                            },
                            {
                                id: "arbitrage",
                                Header: "Arbitrage Opp.",
                                accessor: d => d.arbitrage,
                                Cell: row => {
                                    if (row.original.arbitrage) {
                                        return (
                                            <div
                                                style={{
                                                    width: '100%',
                                                    height: '100%'
                                                }}
                                            >
                                                <Icon fontSize="small">star</Icon>
                                            </div>
                                        );
                                    }
                                }
                            }
                        ]}
                        SubComponent={row => {
                            return (
                                <div style={{ paddingTop: 10, paddingBottom: 15 }}>
                                    <table style={{ width: '100%', backgroundColor: 'light-grey' }}>
                                        <tbody>
                                           <tr>
                                               <th style={{ backgroundColor: '#D3D3D3' }}>Exchange</th>
                                               <th style={{ backgroundColor: '#D3D3D3' }}>Quantity</th>
                                           </tr>
                                           <tr>
                                               <td style={{ backgroundColor: '#88C8FC' }}>Bittrex</td>
                                               <td>{row.original.bittrex}</td>
                                           </tr>
                                           <tr>
                                               <td style={{ backgroundColor: '#07ED85' }}>Poloniex</td>
                                               <td>{row.original.poloniex}</td>
                                           </tr>
                                           <tr>
                                               <td style={{ backgroundColor: '#F3BA2E' }}>Binance</td>
                                               <td>{row.original.binance}</td>
                                           </tr>
                                       </tbody>
                                    </table>
                                </div>
                            );
                        }}
                    />}
                </div>
            </div>
        );
    }
}

export default App;
