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
} from 'snarkyjs'
import { genesisHeader, Header, HeaderChain } from './BlockHeader.js';


const main = async () => {
    await isReady

    // await fibonacci(5)
    await blockHeaders(5)
}

const timeit = async (
    label: string,
    callback: (...args: any[]) => any,
    ...args: any[]
) => {
    console.log(`${label}...`)
    console.time(label)
    const out = await callback(...args)
    console.timeLog(label)
    return out
}

// proving N'th fibonacci number
const fibonacci = async (N = 2) => {
    const { verificationKey } = await timeit("compile", FibonacciSequence.compile)

    const fib0: Proof<Fibonacci> = await timeit("fib0", FibonacciSequence.fib0, new Fibonacci(Field.zero, Field.zero))
    const fib1: Proof<Fibonacci> = await timeit("fib1", FibonacciSequence.fib1, new Fibonacci(Field.one, Field.zero))

    let fib_n: Proof<Fibonacci>,
        fib_n_1: Proof<Fibonacci>

    // true sequence starting from fib0 + fib1
    fib_n = fib1
    fib_n_1 = fib0
    for (let n = 2; n <= N; n++) {
        let publicInput = new Fibonacci(
            fib_n.publicInput.value.add(fib_n_1.publicInput.value),
            fib_n.publicInput.value,
        )
        let fib = await timeit(`fib${n}`, FibonacciSequence.fibn, publicInput, fib_n, fib_n_1)
        fib_n_1 = fib_n
        fib_n = fib
    }

    // // false sequence starting from fib1, fib1, 
    // // fails to generate or verify proof
    // let fib2PublicInput = new Fibonacci(fib1.publicInput.value.add(fib1.publicInput.value), fib1.publicInput.value)
    // let fib2: SelfProof<Fibonacci> = await timeit(`fib2`, FibonacciSequence.fibn, fib2PublicInput, fib1, fib1)
    // let fib22PublicInput = new Fibonacci(fib2.publicInput.value.add(fib2.publicInput.value), fib2.publicInput.value)
    // let fib22: SelfProof<Fibonacci> = await timeit(`fib22`, FibonacciSequence.fibn, fib22PublicInput, fib2, fib2)
    // fib_n = fib22

    const status = await timeit("verify", verify, fib_n, verificationKey)
    console.log("status: ", status)
}

const blockHeaders = async (N = 2) => {
    const { verificationKey } = await timeit("compile", HeaderChain.compile)

    const gh = genesisHeader()

    const ghproof: Proof<Header> = await timeit("genesis", HeaderChain.genesis, gh)
    const fhproof: Proof<Header> = await timeit("first", HeaderChain.first, new Header(Field.one, gh.hash(), Field(Field.one.toString())))

    let hproof: Proof<Header>,
        hproof_n_1: Proof<Header>

    // true sequence starting from fib0 + fib1
    hproof = fhproof
    hproof_n_1 = ghproof
    for (let n = 2; n <= N; n++) {
        const num = hproof.publicInput.num.add(Field.one)
        const prev = hproof.publicInput.hash()
        const data = Field(num.toString())
        let hp = await timeit(`h${n}`, HeaderChain.next, new Header(num, prev, data), hproof, hproof_n_1)
        hproof_n_1 = hproof
        hproof = hp
    }

    const status = await timeit("verify", verify, hproof, verificationKey)
    console.log("status: ", status)
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