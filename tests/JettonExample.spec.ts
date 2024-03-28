import {
    Blockchain,
    SandboxContract,
    TreasuryContract,
    printTransactionFees,
    prettyLogTransactions,
} from '@ton/sandbox';
import { Address, Cell, Slice, beginCell, toNano } from '@ton/core';
import { ExampleJettonMaster, ProvideWalletAddress, JettonBurn } from '../build/JettonExample/tact_ExampleJettonMaster';
import { ExampleJettonWallet, JettonTransfer } from '../wrappers/JettonExample_ExampleJettonWallet';
import '@ton/test-utils';

describe('JettonExample', () => {
    let blockchain: Blockchain;
    let owner: SandboxContract<TreasuryContract>;
    let alice: SandboxContract<TreasuryContract>;
    let coco: SandboxContract<TreasuryContract>;
    let jettonMaster: SandboxContract<ExampleJettonMaster>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        owner = await blockchain.treasury('fuck');
        alice = await blockchain.treasury('alice');
        const jetton_content: Cell = beginCell().endCell();
        jettonMaster = blockchain.openContract(await ExampleJettonMaster.fromInit(owner.address, jetton_content));
        const deployResult = await jettonMaster.send(
            owner.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: owner.address,
            to: jettonMaster.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and nFTCollection are ready to use
    });

    it('should mint 1 token to Alice', async () => {
        // Mint 1 token to Alice
        const mintyResult = await jettonMaster.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );
        //printTransactionFees(mintyResult.transactions);

        // Check that Alice send "Mint:1" msg to JettonMaster
        expect(mintyResult.transactions).toHaveTransaction({
            from: alice.address,
            to: jettonMaster.address,
            success: true,
        });

        // Check that JettonMaster send 1 token to Alice's jetton wallet
        const aliceWalletAddress = await jettonMaster.getGetWalletAddress(alice.address);
        expect(mintyResult.transactions).toHaveTransaction({
            from: jettonMaster.address,
            to: aliceWalletAddress,
            success: true,
        });

        // Check that Alice's jetton wallet send JettonExcesses msg to Alice
        expect(mintyResult.transactions).toHaveTransaction({
            from: aliceWalletAddress,
            to: alice.address,
            success: true,
        });

        // Check that Alice's jetton wallet balance is 1
        const aliceJettonContract = blockchain.openContract(await ExampleJettonWallet.fromAddress(aliceWalletAddress));
        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(0n + 1000000000000n);
    });

    it('should Alice send 1 token to Bob', async () => {
        // Mint 1 token to Alice first to build her jetton wallet
        await jettonMaster.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );
        // Alice's jetton wallet address
        const aliceWalletAddress = await jettonMaster.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await ExampleJettonWallet.fromAddress(aliceWalletAddress));

        // Mint 1 token to Bob first to build his jetton wallet
        const bob = await blockchain.treasury('bob');
        const mintyResult = await jettonMaster.send(
            bob.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );
        // Bob's jetton wallet address
        const bobWalletAddress = await jettonMaster.getGetWalletAddress(bob.address);
        // Bob's jetton wallet
        const bobJettonContract = blockchain.openContract(await ExampleJettonWallet.fromAddress(bobWalletAddress));
        const bobBalanceBefore = (await bobJettonContract.getGetWalletData()).balance;

        // Alice transfer 1 token to Bob
        const jettonTransfer: JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: 1n,
            destination: bob.address,
            response_destination: bob.address,
            custom_payload: null,
            forward_ton_amount: 0n,
            forward_payload: beginCell().endCell(),
        };
        const transfterResult = await aliceJettonContract.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            jettonTransfer,
        );
        //printTransactionFees(transfterResult.transactions);

        // Check that Alice send JettonTransfer msg to her jetton wallet
        expect(transfterResult.transactions).toHaveTransaction({
            from: alice.address,
            to: aliceWalletAddress,
            success: true,
        });

        // Check that Alice's jetton wallet send JettonInternalTransfer msg to Bob's jetton wallet
        expect(transfterResult.transactions).toHaveTransaction({
            from: aliceWalletAddress,
            to: bobWalletAddress,
            success: true,
        });

        // Check that Bob's jetton wallet send JettonExcesses msg to Bob
        expect(transfterResult.transactions).toHaveTransaction({
            from: bobWalletAddress,
            to: bob.address,
            success: true,
        });

        // Check that Bob's jetton wallet balance is added 1
        const bobBalanceAfter = (await bobJettonContract.getGetWalletData()).balance;
        expect(bobBalanceAfter).toEqual(bobBalanceBefore + 1n);
    });

    it('should Alice burn 1 token', async () => {
        // Mint 1 token to Alice first to build her jetton wallet
        const mintyResult = await jettonMaster.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );

        const jettonBurn: JettonBurn = {
            $$type: 'JettonBurn',
            query_id: 0n,
            amount: 1n,
            response_destination: alice.address,
            custom_payload: null,
        };

        // Alice's jetton wallet address
        const aliceWalletAddress = await jettonMaster.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await ExampleJettonWallet.fromAddress(aliceWalletAddress));
        // Alice's jetton wallet balance before burning
        const aliceBalanceBefore = (await aliceJettonContract.getGetWalletData()).balance;

        // Alice burn 1 token
        const burnResult = await aliceJettonContract.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            jettonBurn,
        );
        //printTransactionFees(burnResult.transactions);

        // Check that Alice send JettonBurn msg to her jetton wallet
        expect(burnResult.transactions).toHaveTransaction({
            from: alice.address,
            to: aliceWalletAddress,
            success: true,
        });

        // Check that Alice's jetton wallet send JettonBurnNotification msg to JettonMaster
        expect(burnResult.transactions).toHaveTransaction({
            from: aliceWalletAddress,
            to: jettonMaster.address,
            success: true,
        });

        // Check that JettonMaster send JettonExcesses msg to Alice
        expect(burnResult.transactions).toHaveTransaction({
            from: jettonMaster.address,
            to: alice.address,
            success: true,
        });

        // Check that Alice's jetton wallet balance is subtracted 1
        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(aliceBalanceBefore - 1n);
    });

    it("should discover JettonWallet's address", async () => {
        coco = await blockchain.treasury('coco');

        const provideWalletAddress: ProvideWalletAddress = {
            $$type: 'ProvideWalletAddress',
            query_id: 0n,
            owner_address: coco.address,
            include_address: true,
        };

        // coco send ProvideWalletAddress msg to JettonMaster
        const provideWalletAddressResult = await jettonMaster.send(
            coco.getSender(),
            {
                value: toNano('10'),
            },
            provideWalletAddress,
        );

        // printTransactionFees(provideWalletAddressResult.transactions);
        // prettyLogTransactions(provideWalletAddressResult.transactions);

        expect(provideWalletAddressResult.transactions).toHaveTransaction({
            from: coco.address,
            to: jettonMaster.address,
            success: true,
        });

        expect(provideWalletAddressResult.transactions).toHaveTransaction({
            from: jettonMaster.address,
            to: coco.address,
            success: true,
        });
    });
    it("should discover JettonWallet's address", async () => {
        alice = await blockchain.treasury('alice');
        // Mint 1 token to Alice first to build her jetton wallet
        const mintyResult = await jettonMaster.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );
        // Alice's jetton wallet address
        const aliceWalletAddress = await jettonMaster.getGetWalletAddress(alice.address);

        // send ProvideWalletAddress msg to JettonMaster
        const provideWalletAddress: ProvideWalletAddress = {
            $$type: 'ProvideWalletAddress',
            query_id: 0n,
            owner_address: alice.address,
            include_address: true,
        };
        const provideWalletAddressResult = await jettonMaster.send(
            alice.getSender(),
            {
                value: toNano('10'),
            },
            provideWalletAddress,
        );
        // check that Alice send ProvideWalletAddress msg to JettonMaster
        expect(provideWalletAddressResult.transactions).toHaveTransaction({
            from: alice.address,
            to: jettonMaster.address,
            success: true,
        });
        // check that JettonMaster send ProvideWalletAddressResponse msg to Alice
        expect(provideWalletAddressResult.transactions).toHaveTransaction({
            from: jettonMaster.address,
            to: alice.address,
            success: true,
        });
        // check that the response contains the correct address
        // @ts-ignore

        const response = provideWalletAddressResult['events'][1].body;
        // console.log(response);
        const parseResult: Slice = response.beginParse();
        const opCode = parseResult.loadUint(32);
        // console.log(opCode);
        const queryId = parseResult.loadUint(64);
        // console.log(queryId);
        const jettonWalletAddress = parseResult.loadAddress().toString();
        // console.log(jettonWalletAddress);
        expect(jettonWalletAddress).toEqual(aliceWalletAddress.toString());
    });
    it('should fail to discover JettonWallet address', async () => {
        alice = await blockchain.treasury('alice');

        // send ProvideWalletAddress msg to JettonMaster
        const provideWalletAddress: ProvideWalletAddress = {
            $$type: 'ProvideWalletAddress',
            query_id: 0n,
            owner_address: alice.address,
            include_address: false,
        };
        const provideWalletAddressResult = await jettonMaster.send(
            alice.getSender(),
            {
                value: toNano('10'),
            },
            provideWalletAddress,
        );
        // check that Alice send ProvideWalletAddress msg to JettonMaster
        expect(provideWalletAddressResult.transactions).toHaveTransaction({
            from: alice.address,
            to: jettonMaster.address,
            success: true,
        });
        // check that JettonMaster send ProvideWalletAddressResponse msg to Alice
        expect(provideWalletAddressResult.transactions).toHaveTransaction({
            from: jettonMaster.address,
            to: alice.address,
            success: true,
        });
        // check that the response contains the correct address
        // @ts-ignore
        const response = provideWalletAddressResult['events'][1].body;
        // console.log(response);
        const parseResult: Slice = response.beginParse();
        const opCode = parseResult.loadUint(32);
        // console.log(opCode);
        const queryId = parseResult.loadUint(64);
        // console.log(queryId);
        const jettonWalletAddress = parseResult.loadUint(2);
        // console.log(jettonWalletAddress);
        expect(jettonWalletAddress).toEqual(0);
        const include_address = parseResult.loadMaybeRef();
        // console.log(include_address);
        expect(include_address).toEqual(null);
    });
    it('should fail to discover JettonWallet address', async () => {
        alice = await blockchain.treasury('alice');

        const wrongWorkChainAddress = Address.parseRaw(
            '-1:510021ff261b39612b080982312c030e3d101fdf25856cb83c8bdda294b18493',
        );
        // console.log(wrongWorkChainAddress);
        // send ProvideWalletAddress msg to JettonMaster
        const provideWalletAddress: ProvideWalletAddress = {
            $$type: 'ProvideWalletAddress',
            query_id: 0n,
            owner_address: wrongWorkChainAddress,
            include_address: true,
        };
        const provideWalletAddressResult = await jettonMaster.send(
            alice.getSender(),
            {
                value: toNano('10'),
            },
            provideWalletAddress,
        );

        // prettyLogTransactions(provideWalletAddressResult.transactions);
        // printTransactionFees(provideWalletAddressResult.transactions);

        // check that Alice send ProvideWalletAddress msg to JettonMaster
        expect(provideWalletAddressResult.transactions).toHaveTransaction({
            from: alice.address,
            to: jettonMaster.address,
            success: true,
        });
        // check that JettonMaster send ProvideWalletAddressResponse msg to Alice
        expect(provideWalletAddressResult.transactions).toHaveTransaction({
            from: jettonMaster.address,
            to: alice.address,
            success: true,
        });
        // check that the response contains the correct address
        // @ts-ignore
        const response = provideWalletAddressResult['events'][1].body;
        // console.log(response);
        const parseResult: Slice = response.beginParse();
        const opCode = parseResult.loadUint(32);
        // console.log(opCode);
        const queryId = parseResult.loadUint(64);
        // console.log(queryId);
        const jettonWalletAddress = parseResult.loadUint(2);
        // console.log(jettonWalletAddress);
        expect(jettonWalletAddress).toEqual(0);
        const include_address = parseResult.loadMaybeRef()?.beginParse().loadAddress();
        // console.log(include_address);
        expect(include_address?.toString()).toEqual(wrongWorkChainAddress.toString());
    });
});
