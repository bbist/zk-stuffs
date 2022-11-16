import {
    Field,
    SelfProof,
    Experimental,
    AsFieldElements,
} from 'snarkyjs';


type StaticImplements<I extends new (...args: any[]) => any, C extends I> = InstanceType<I>

interface FibonacciAsFieldElements extends AsFieldElements<Fibonacci> {
    new(...args: any[]): any
}

export class Fibonacci implements StaticImplements<FibonacciAsFieldElements, typeof Fibonacci> {
    prev: Field
    value: Field

    constructor(value: Field, prev: Field) {
        this.prev = prev
        this.value = value
    }

    ofFields(fields: Field[]) {
        return new Fibonacci(fields[0], fields[1])
    }

    static ofFields(fields: Field[]): Fibonacci {
        return new Fibonacci(fields[0], fields[1])

    }

    static toFields(x: Fibonacci): Field[] {
        return [x.value, x.prev]
    }

    static check(x: Fibonacci) { }

    static sizeInFields(): number {
        return 2
    }

}

export const FibonacciSequence = Experimental.ZkProgram({
    publicInput: Fibonacci,
    methods: {
        fib0: {
            privateInputs: [],
            method(n: Fibonacci) {
                n.prev.assertEquals(Field.zero)
                n.value.assertEquals(Field.zero)
            },
        },
        fib1: {
            privateInputs: [],
            method(n: Fibonacci) {
                n.prev.assertEquals(Field.zero)
                n.value.assertEquals(Field.one)
            },
        },
        fibn: {
            privateInputs: [SelfProof, SelfProof],
            method(n: Fibonacci, n_1: SelfProof<Fibonacci>, n_2: SelfProof<Fibonacci>) {
                n_1.publicInput.prev.assertEquals(n_2.publicInput.value)
                n_1.verify()
                n_2.verify()
                n.prev.assertEquals(n_1.publicInput.value)
                n.value.assertEquals(n_1.publicInput.value.add(n_2.publicInput.value))
            },
        },
    }
})