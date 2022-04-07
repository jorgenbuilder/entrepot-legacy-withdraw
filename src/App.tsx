import React from 'react';
import { useState } from 'react'
import logo from './logo.svg'
import './App.css'
import useStore from './store';
import { SubAccount } from './canisters/ledger/ledger.did';
// @ts-ignore
import { principalToAccountIdentifier, buf2hex } from './ext'

function App() {

    const { connected, connecting, stoicConnect, plugConnect, disconnect, actor, ledgerActor, principal } = useStore();

    const [loading, setLoading] = React.useState(false);
    const [payments, setPayments] = React.useState<SubAccount[]>();

    const findPayments = React.useMemo(() => function () {
        if (!actor) return;
        setLoading(true);
        actor.payments()
        .then(r => {
            setPayments([r?.[0]?.[0] || []])
            setLoading(false);
        })
    }, [actor, payments]);

    const withdraw = React.useMemo(() => function () {
        if (!payments || !ledgerActor || !principal) return;
        setLoading(true)
        for (const payment of payments) {
            const self = principalToAccountIdentifier(principal, undefined);
            const account = principalToAccountIdentifier(principal, payment);
            console.log(buf2hex(account));
            ledgerActor.account_balance({
                account: Array.from(account)
            })
            .then(r => {
                console.log(r)
                ledgerActor.transfer({
                    from_subaccount: [Array.from(payment)],
                    to: Array.from(self),
                    fee: { e8s: BigInt(10_000) },
                    amount: { e8s : r.e8s - BigInt(10_000) },
                    memo: BigInt(0),
                    created_at_time: [],
                })
                .then((x) => {
                    console.log(x)
                    alert(`Withdrew ${(Number(r.e8s) / 10 ** 8).toFixed(2)} ICP`)
                })
                .finally(() => setLoading(false))
            })
        }
    }, [principal, payments]);

    return (
        <div className="App">
            <h1>Entrepot Payments Recovery</h1>
            <p>This will allow you to withdraw funds for the Magicians that you sold.</p>
            <p><strong>Warning!</strong> Connecting to an app with your stoic wallet can result in loss of funds. Never connect to apps that you do not trust.</p>
            {
                connected
                ? <>
                    <button onClick={disconnect}>Disconnect</button>
                </>
                : <>
                    <button onClick={stoicConnect} disabled={connecting}>Connect Stoic</button>
                    <button onClick={plugConnect} disabled={connecting}>Connect Plug</button>
                </>
            }
            <br />
            <br />
            {
                connected && <>
                    <button onClick={findPayments} disabled={loading}>Find Payments</button>
                </>
            }
            {
                payments && <>
                    <p>Found {payments.length} payments!</p>
                    <button onClick={withdraw} disabled={loading}>Withdraw</button>
                </>
            }
        </div>
    )
}

export default App
