import Fibonacci from './Fibonacci';

describe('Fibonacci.js', () => {
  describe('Fibonacci()', () => {
    it.todo('should be correct');
  });
});

// import { Add } from './Add';
// import {
//   isReady,
//   shutdown,
//   Field,
//   Mina,
//   PrivateKey,
//   PublicKey,
//   AccountUpdate,
// } from 'snarkyjs';

// /*
//  * This file specifies how to test the `Add` example smart contract. It is safe to delete this file and replace
//  * with your own tests.
//  *
//  * See https://docs.minaprotocol.com/zkapps for more info.
//  */

// function createLocalBlockchain() {
//   const Local = Mina.LocalBlockchain();
//   Mina.setActiveInstance(Local);
//   return Local.testAccounts[0].privateKey;
// }

// async function localDeploy(
//   zkAppInstance: Add,
//   zkAppPrivatekey: PrivateKey,
//   deployerAccount: PrivateKey
// ) {
//   const txn = await Mina.transaction(deployerAccount, () => {
//     AccountUpdate.fundNewAccount(deployerAccount);
//     zkAppInstance.deploy({ zkappKey: zkAppPrivatekey });
//     zkAppInstance.init();
//     zkAppInstance.sign(zkAppPrivatekey);
//   });
//   await txn.send().wait();
// }

// describe("Fib", () => {
//   let deployerAccount: PrivateKey,
//     zkAppAddress: PublicKey,
//     zkAppPrivateKey: PrivateKey;
  
//   beforeEach(async () => {
//     await isReady;
//     deployerAccount = createLocalBlockchain();
//     zkAppPrivateKey = PrivateKey.random();
//     zkAppAddress = zkAppPrivateKey.toPublicKey();
//   });

//   afterAll(async () => {
//     setTimeout(shutdown, 0);
//   });
  
//   it('deploy and test Fib smart contract', async () => {
//     const zkAppInstance = new Add(zkAppAddress);
//     await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
//     const num = zkAppInstance.num.get();
//     expect(num).toEqual(Field.one);
//   });

//   it("generate proof", async () => {
//     const app = new Add(zkAppAddress)
//     await localDeploy(app, zkAppPrivateKey, deployerAccount)
//     const fib_n_2 = app.fib0(Field.zero)
//     const fib_n_1 = app.fib1(Field.one)

//     let fib_n

//     const N = 10
//     for (let n = 2; n <= N; n++) {
//       console.log(`working on fib_${n}...`)
//       let publicInput: Field = fib_n_1.publicInput.add(fib_n_2.publicInput)

//     }

//   })
// })

// // describe('Add', () => {
// //   let deployerAccount: PrivateKey,
// //     zkAppAddress: PublicKey,
// //     zkAppPrivateKey: PrivateKey;

// //   beforeEach(async () => {
// //     await isReady;
// //     deployerAccount = createLocalBlockchain();
// //     zkAppPrivateKey = PrivateKey.random();
// //     zkAppAddress = zkAppPrivateKey.toPublicKey();
// //   });

// //   afterAll(async () => {
// //     // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
// //     // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
// //     // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
// //     setTimeout(shutdown, 0);
// //   });

// //   it('generates and deploys the `Add` smart contract', async () => {
// //     const zkAppInstance = new Add(zkAppAddress);
// //     await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
// //     const num = zkAppInstance.num.get();
// //     expect(num).toEqual(Field.one);
// //   });

// //   it('correctly updates the num state on the `Add` smart contract', async () => {
// //     const zkAppInstance = new Add(zkAppAddress);
// //     await localDeploy(zkAppInstance, zkAppPrivateKey, deployerAccount);
// //     const txn = await Mina.transaction(deployerAccount, () => {
// //       zkAppInstance.update();
// //       zkAppInstance.sign(zkAppPrivateKey);
// //     });
// //     await txn.send().wait();

// //     const updatedNum = zkAppInstance.num.get();
// //     expect(updatedNum).toEqual(Field(3));
// //   });
// // });
