import create from 'zustand'
import { StoicIdentity } from "ic-stoic-identity";
import { Actor, ActorSubclass, Agent, HttpAgent } from '@dfinity/agent'
import { IDL } from '@dfinity/candid'
import { Principal } from '@dfinity/principal';
// @ts-ignore
import { Ledger, idlFactory as nnsIdl } from './canisters/ledger/ledger.did.js'
// @ts-ignore
import { LegendsNFT, idlFactory as legendsIdl } from './canisters/legends/legends.did.js'

interface Store {

    actor?          : ActorSubclass<LegendsNFT>;
    principal?      : Principal;
    connected       : boolean;
    connecting      : boolean;
    idempotentConnect: () => null | (() => void);
    stoicConnect    : () => void;
    plugConnect     : () => void;
    disconnect      : () => void;
    wallet?         : 'stoic' | 'plug';
    
    ledgerActor?    : ActorSubclass<Ledger>;
};

const ledgerCanisterId = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
const legendsCanisterId = 'cwu5z-wyaaa-aaaaj-qaoaq-cai';
const host = 'https://ic0.app';
const whitelist = [legendsCanisterId];

const useStore = create<Store>((set, get) => ({

    // Wallets

    connected: false,
    connecting: false,

    idempotentConnect () {
        const { connecting } = get();
        if (connecting) return null;
        set({ connecting: true });
        return () => {
            set({ connecting: false });
        };
    },

    async stoicConnect () {

        const complete = get().idempotentConnect()
        if (complete === null) return;

        StoicIdentity.load().then(async (identity : any) => {
            if (identity !== false) {
              // ID is a already connected wallet!
            } else {
              // No existing connection, lets make one!
              identity = await StoicIdentity.connect();
            };

            const agent = new HttpAgent({
                identity,
                host,
            });

            // Create an nns actor
            const nns = Actor.createActor<Ledger>(nnsIdl, {
                agent,
                canisterId: ledgerCanisterId,
            });

            // Create actor
            const actor = Actor.createActor<LegendsNFT>(legendsIdl, {
                agent,
                canisterId: legendsCanisterId,
            });

            complete();
            set(() => ({ connected: true, principal: identity.getPrincipal(), wallet: 'stoic', ledgerActor: nns, actor }));
        });
    },

    async plugConnect () {

        const complete = get().idempotentConnect();
        if (complete === null) return;

        // If the user doesn't have plug, send them to get it!
        if (window?.ic?.plug === undefined) {
            window.open('https://plugwallet.ooo/', '_blank');
            return;
        }
        
        await window.ic.plug.requestConnect({ whitelist, host }).catch(complete);

        const agent = await window.ic.plug.agent;
        const principal = await agent.getPrincipal();

        const actor = await window?.ic?.plug?.createActor<LegendsNFT>({
            canisterId: legendsCanisterId,
            interfaceFactory: legendsIdl,
        });

        complete();
        set(() => ({ connected: true, principal, wallet: 'plug', actor }));
    },

    disconnect () {
        StoicIdentity.disconnect();
        window.ic?.plug?.deleteAgent();
        set({ connected: false, principal: undefined, actor: undefined, wallet: undefined, ledgerActor: undefined });
    },

}));

export default useStore;


// This is the stuff that plug wallet extension stuffs into the global window namespace.
// I stole this for Norton: https://github.com/FloorLamp/cubic/blob/3b9139b4f2d16bf142bf35f2efb4c29d6f637860/src/ui/components/Buttons/LoginButton.tsx#L59
declare global {
    interface Window {
        ic?: {
            plug?: {
                agent: any;
                createActor: <T>(args : {
                    canisterId          : string,
                    interfaceFactory    : IDL.InterfaceFactory,
                }) => ActorSubclass<T>,
                isConnected : () => Promise<boolean>;
                createAgent : (args?: {
                    whitelist   : string[];
                    host?       : string;
                }) => Promise<undefined>;
                requestBalance: () => Promise<
                    Array<{
                        amount      : number;
                        canisterId  : string | null;
                        image       : string;
                        name        : string;
                        symbol      : string;
                        value       : number | null;
                    }>
                >;
                requestTransfer: (arg: {
                    to      : string;
                    amount  : number;
                    opts?   : {
                        fee?            : number;
                        memo?           : number;
                        from_subaccount?: number;
                        created_at_time?: {
                            timestamp_nanos: number;
                        };
                    };
                }) => Promise<{ height: number }>;
                requestConnect: (opts: any) => Promise<'allowed' | 'denied'>;
                deleteAgent: () => Promise<void>;
            };
        };
    }
}

function hexStringToByteArray(hexString : string) {
    if (hexString.length % 2 !== 0) {
        throw "Must have an even number of hex digits to convert to bytes";
    }
    var numBytes = hexString.length / 2;
    var byteArray = new Uint8Array(numBytes);
    for (var i=0; i<numBytes; i++) {
        byteArray[i] = parseInt(hexString.substr(i*2, 2), 16);
    }
    return byteArray;
}