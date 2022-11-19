import { SimpleContract } from './SimpleContract.js';
import { FibonacciSequence, Fibonacci } from './Fibonacci.js';

import {
    isReady,
    shutdown,
    Field,
    Mina,
    PrivateKey,
    AccountUpdate,
    verify,
    Proof,
    Bool,
} from 'snarkyjs'
import { HeaderChain, Sig, Header } from './BlockHeader.js';
import { AddOne } from './AddOne.js';


const main = async () => {
    await isReady

    try {
        // addone(5)
        // await fibonacci(5)
        await blockHeaders(5)
    } catch (error) {
        console.error(error)
    }
}

const timeit = async (
    label: string,
    callback: (...args: any[]) => any,
    ...args: any[]
) => {
    const prefix = `${label}...`
    process.stdout.write(prefix)
    console.time(label)
    const out = await callback(...args)
    process.stdout.moveCursor(-prefix.length, 0)
    console.timeLog(label)
    return out
}

const addone = async (N = 2) => {
    const { verificationKey } = await timeit("compile", AddOne.compile)

    const base: Proof<Field> = await timeit("base", AddOne.base, Field(0))

    let prf = base
    for (let n = 1; n <= N; n++) {
        console.log(`status(${n - 1}):`, await timeit(`verify(${n - 1})`, verify, prf, verificationKey))
        console.log(prf.toJSON().proof.length)
        prf = await timeit(`step${n}`, AddOne.step, Field(n), prf, prf)
    }

    console.log(`status(${N}):`, await timeit(`verify(${N})`, verify, prf, verificationKey))
}

// proving N'th fibonacci number
const fibonacci = async (N = 2) => {
    const { verificationKey } = await timeit("compile", FibonacciSequence.compile)

    const fib0: Proof<Fibonacci> = await timeit("fib0", FibonacciSequence.fib0, new Fibonacci(Field(0), Field(0)))
    const fib1: Proof<Fibonacci> = await timeit("fib1", FibonacciSequence.fib1, new Fibonacci(Field(1), Field(0)))

    let fib_n: Proof<Fibonacci>,
        fib_n_1: Proof<Fibonacci>

    // true sequence starting from fib0 + fib1
    fib_n = fib1
    fib_n_1 = fib0
    for (let n = 2; n <= N; n++) {
        console.log(`status(${n - 1}):`, await timeit(`verify(${n - 1})`, verify, fib_n, verificationKey))
        console.log(fib_n.toJSON().proof.length)

        let publicInput = new Fibonacci(
            fib_n.publicInput.value.add(fib_n_1.publicInput.value),
            fib_n.publicInput.value,
        )
        let fib = await timeit(`fib${n}`, FibonacciSequence.fibn, publicInput, fib_n, fib_n_1)
        fib_n_1 = fib_n
        fib_n = fib
    }

    console.log(`status(${N}):`, await timeit(`verify(${N})`, verify, fib_n, verificationKey))
}


const blockHeaders = async (N = 2) => {

    const { verificationKey } = await timeit("compile", HeaderChain.compile)

    const h0 = Header.h0()

    const h0prf: Proof<Header> = await timeit("h0", HeaderChain.h0, h0)

    let hprf = h0prf
    for (let n = 1; n <= N; n++) {
        console.log(`status(${n - 1}):`, await timeit(`verify(${n - 1})`, verify, hprf, verificationKey))
        console.log(hprf.toJSON())

        const hpub = hprf.publicInput
        const num = hpub.num.add(1)
        let vals: Field[] = [...hpub.vals]
        let extra = Field(0)

        // change validators and update extra at epoch change
        if (num.toBigInt() % BigInt(Header.epochSize) == BigInt(0)) {
            vals = Header.randomValidators(Header.maxvals)
            extra = Field.ofBits(vals.reduce((p, v) => {
                return [...p, ...v.toBits().slice(0, Sig.valbits)]
            }, new Array<Bool>()))
        }

        const h = new Header(num, hpub.hash(), Field(num.toString()), extra, vals, [])

        // if (num.toBigInt() % BigInt(Header.epochSize) == BigInt(0)) {
        //     h.extra = Field(0)
        // } // no extra data at epoch change

        // if (num.toBigInt() % BigInt(Header.epochSize) == BigInt(0)) {
        //     const bits = h.extra.toBits()
        //     bits[0] = bits[0].not()
        //     h.extra = Field.ofBits(bits)
        // } // incorrect extra data at epoch change

        h.sigs = hpub.vals.map(val => Sig.create(h.hash(), val).toField())

        // h.sigs.forEach((_, i) => {
        //     if (i <= Header.maxvals / 2) {
        //         h.sigs[i] = Field(0)
        //     }
        // }) // insufficient signatures (< 1/2 of required vals)

        // h.sigs.forEach((_, i) => {
        //     if (i <= Header.maxvals / 2) {
        //         const sig = Sig.fromField(h.sigs[i])
        //         sig._h12[0] = sig._h12[0].not() // flip first bit
        //         h.sigs[i] = sig.toField()
        //     }
        // }) // invalid signatures (< 1/2 of required vals)

        hprf = await timeit(`h(${n})`, HeaderChain.next, h, hprf, hprf)
    }

    console.log(`status(${N}):`, await timeit("verify", verify, hprf, verificationKey))
}

const simpleContract = async () => {

    const Local = Mina.LocalBlockchain()
    Mina.setActiveInstance(Local)

    const deployerAccount = Local.testAccounts[0].privateKey;

    // ----------------------------------------------------
    // Create a public/private key pair. The public key is our address and where we will deploy to
    const zkAppPrivateKey = PrivateKey.random()
    const zkAppAddress = zkAppPrivateKey.toPublicKey()

    const salt = Field.random()

    // Create an instance of our smart contract and deploy it to zkAppAddress
    const contract = new SimpleContract(zkAppAddress)
    const deployTxn = await Mina.transaction(deployerAccount, () => {
        AccountUpdate.fundNewAccount(deployerAccount)
        contract.deploy({ zkappKey: zkAppPrivateKey })
        contract.init(salt, Field(750));
        contract.sign(zkAppPrivateKey);
    });
    await deployTxn.send().wait();
    // ----------------------------------------------------

    // state of our zkApp account after deployment    
    let txn

    const n0 = contract.num.get()
    console.log("num after init:", n0.toString())

    // contract.incrementNum()
    txn = await Mina.transaction(deployerAccount, () => {
        contract.incrementNum()
        contract.sign(zkAppPrivateKey)
    });
    await txn.send().wait();

    const n1 = contract.num.get()
    console.log("num after increment:", n1.toString())

    const s0 = contract.secret.get();
    console.log('secret after init:', s0.toString());

    // contract.incrementSecret(salt, Field(750))
    txn = await Mina.transaction(deployerAccount, () => {
        contract.incrementSecret(salt, Field(750))
        contract.sign(zkAppPrivateKey)
    });
    await txn.send().wait();

    const s1 = contract.secret.get()
    console.log("secret after increment:", s1.toString())

    await shutdown();
}

main()