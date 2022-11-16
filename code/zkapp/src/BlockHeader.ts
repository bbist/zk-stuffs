import {
    Field,
    SelfProof,
    Experimental,
    AsFieldElements,
    Poseidon,
} from 'snarkyjs';


type StaticImplements<I extends new (...args: any[]) => any, C extends I> = InstanceType<I>

interface HeaderAsFieldElements extends AsFieldElements<Header> {
    new(...args: any[]): any
}

export class Header implements StaticImplements<HeaderAsFieldElements, typeof Header> {
    num: Field
    prev: Field
    data: Field

    constructor(num: Field, prev: Field, data: Field) {
        this.num = num
        this.prev = prev
        this.data = data
    }

    hash() {
        return Poseidon.hash([this.num, this.prev, this.data])
    }

    ofFields(fields: Field[]) {
        return new Header(fields[0], fields[1], fields[2])
    }

    static ofFields(fields: Field[]): Header {
        return new Header(fields[0], fields[1], fields[2])
    }

    static toFields(x: Header): Field[] {
        return [x.num, x.prev, x.data]
    }

    static check(x: Header) { }

    static sizeInFields(): number {
        return 3
    }

}

export const genesisHeader = () => {
    return new Header(Field.zero, Field.zero, Field(Field.zero.toString()))
}

export const HeaderChain = Experimental.ZkProgram({
    publicInput: Header,
    methods: {
        genesis: {
            privateInputs: [],
            method(h: Header) {
                const gh = genesisHeader()
                h.num.assertEquals(gh.num)
                h.prev.assertEquals(gh.prev)
                h.data.assertEquals(gh.data)
            },
        },
        first: {
            privateInputs: [],
            method(h: Header) {
                const gh = genesisHeader()
                const num = gh.num.add(Field.one)
                h.num.assertEquals(num)
                h.prev.assertEquals(gh.hash())
                h.data.assertEquals(Field(num.toString()))
            },
        },
        next: {
            privateInputs: [SelfProof, SelfProof],
            method(h: Header, h_1: SelfProof<Header>, h_2: SelfProof<Header>) {
                h_2.verify()
                h_1.verify()
                h.prev.assertEquals(h_1.publicInput.hash()) // proof that h_1 is linked to h
                h_1.publicInput.prev.assertEquals(h_2.publicInput.hash())
            },
        },
    }
})
