import {
    Field,
    SelfProof,
    Experimental,
    AsFieldElements,
    Poseidon,
    Circuit,
    Bool,
} from 'snarkyjs';


type StaticImplements<I extends new (...args: any[]) => any, C extends I> = InstanceType<I>

interface ClassAsFieldElements<T> extends AsFieldElements<T> {
    new(...args: any[]): any
}

export class Sig {
    // field bit length is 255 bits, only 254 bits can be used
    static h12bits = 8 // 8 * 12 - 1 : for a full field length signature
    static valbits = 5 // 8 * 20 - 1 : ^^
    // with 13 bits (8 h12 + 5 val) signature, we can fit up to 19 (247 bits) unique signatures in a field

    _h12: Bool[]
    _val: Bool[]

    get h12() { return Field.ofBits(this._h12) }
    get val() { return Field.ofBits(this._val) }

    toString() {
        return `"${this.h12.toString()}" : "${this.val.toString()}"`
    }

    toField() {
        return Field.ofBits([...this._h12, ...this._val])
    }

    static fromField(field: Field) {
        const sig = new Sig()
        const bits = field.toBits()
        sig._h12 = bits.slice(0, Sig.h12bits)
        sig._val = bits.slice(Sig.h12bits, Sig.h12bits + Sig.valbits)
        return sig
    }

    static create(hash: Field, val: Field) {
        const sig = new Sig()
        let _h12 = hash.toBits().slice(0, Sig.h12bits)
        let _val = val.toBits().slice(0, Sig.valbits)
        sig._h12 = [..._h12, ...new Array<Bool>(Sig.h12bits - _h12.length).fill(Bool(false))]
        sig._val = [..._val, ...new Array<Bool>(Sig.valbits - _val.length).fill(Bool(false))]
        return sig
    }
}

export class Header implements StaticImplements<ClassAsFieldElements<Header>, typeof Header> {
    static epochSize = 2
    static maxvals = 2

    num: Field
    prev: Field
    data: Field
    extra: Field // bytes, [validators]: [validators_list(20*8)]

    vals: Field[] // validators present in extra data of this header
    sigs: Field[] // signatures from validators that signed this header

    constructor(num: Field, prev: Field, data: Field, extra: Field, vals: Field[], sigs: Field[]) {
        this.num = num
        this.prev = prev
        this.data = data
        this.extra = extra
        this.vals = [...vals, ...Array.from(new Array<Field>(Header.maxvals - vals.length)).fill(Field(0))]
        this.sigs = [...sigs, ...Array.from(new Array<Field>(Header.maxvals - sigs.length)).fill(Field(0))]
    }

    hash() {
        return Poseidon.hash([this.num, this.prev, this.data, this.extra])
    }


    ofFields(fields: Field[]) {
        return new Header(
            fields[0], fields[1], fields[2], fields[3],
            fields.slice(4, 4 + Header.maxvals), fields.slice(4 + Header.maxvals))
    }

    static ofFields(fields: Field[]): Header {
        return new Header(
            fields[0], fields[1], fields[2], fields[3],
            fields.slice(4, 4 + Header.maxvals), fields.slice(4 + Header.maxvals))
    }

    static toFields(x: Header): Field[] {
        return [x.num, x.prev, x.data, x.extra, ...x.vals, ...x.sigs]
    }

    static check(x: Header) { }

    static sizeInFields(): number {
        return 4 + 2 * Header.maxvals
    }

    static h0() {
        const vals = Array.
            from(new Array(Header.maxvals)).
            map((_, i) => Header.validatorSet()[i])
        return new Header(
            Field(0), Field(0), Field(Field(0).toString()), Field(0),
            vals, vals.map(() => Field(0)))
    }

    static validatorSetSize() {
        return Math.floor(254 / (Sig.h12bits + Sig.valbits))
    }

    static validatorSet() {
        return Array.from(new Array(Header.validatorSetSize())).map((_, i) => Field(i + 1))
    }

    static randomValidators(n: number) {
        const valset = Header.validatorSet()
        let vals = valset.map((): Field | null => null)
        while (vals.filter(v => v != null).length < n) {
            const i = Math.round(Header.validatorSetSize() * Math.random())
            if (vals[i] == null) vals[i] = valset[i]
        }
        return vals.reduce((p, v) => v == null ? p : [...p, v], new Array<Field>())
    }

}

export const HeaderChain = Experimental.ZkProgram({
    publicInput: Header,
    methods: {
        h0: {
            privateInputs: [],
            method(h: Header) {
                const h0 = Header.h0()
                h.num.assertEquals(h0.num)
                h.prev.assertEquals(h0.prev)
                h.data.assertEquals(h0.data)
                h.extra.assertEquals(h0.extra)
                for (let i = 0; i < Header.maxvals; i++) {
                    h.vals[i].assertEquals(h0.vals[i])
                    h.sigs[i].assertEquals(h0.sigs[i])
                }
            },
        },
        next: {
            // TODO: for some reason doesn't work with single self proof
            privateInputs: [SelfProof<Header>, SelfProof<Header>],
            method(h: Header, h_1p: SelfProof<Header>, _: SelfProof<Header>) {
                h_1p.verify()

                const h_1 = h_1p.publicInput

                h.prev.assertEquals(h_1.hash()) // link from h_1 to h
                h.num.assertEquals(h_1.num.add(1)) // block number is in order

                const h12 = Field.ofBits(h.hash().toBits().slice(0, Sig.h12bits))
                
                let valCount = Field(0)
                let sigCount = Field(0)
                for (let i = 0; i < Header.maxvals; i++) {
                    const sig = Sig.fromField(h.sigs[i])

                    // validators that could have signed this header
                    valCount = h_1.vals[i].gt(0).toField().add(valCount)

                    // valid signatures
                    sigCount = sig.val.equals(h_1.vals[i]).
                        and(sig.val.gt(0)).and(sig.h12.equals(h12)).
                        toField().add(sigCount)
                }

                const threshold = Circuit.witness(Field, () => {
                    const x2 = BigInt(2) * valCount.toBigInt()
                    let x2by3 = x2 / BigInt(3)
                    if (x2 % BigInt(3) != BigInt(0)) x2by3 += BigInt(1)
                    return Field.fromBigInt(x2by3)
                })
                sigCount.assertGte(threshold) // >= 2/3

                // ensure validators change is correct
                const atEpochChange = Circuit.witness(Field, () => {
                    return new Field(h.num.toBigInt() % BigInt(Header.epochSize))
                }).equals(0)
                Circuit.if(atEpochChange,
                    (() => {
                        let invalidCount = Field(0)
                        const bits = h.extra.toBits()
                        for (let i = 0; i < Header.maxvals; i++) {
                            const val = Field.ofBits(bits.slice(
                                i * Sig.valbits, (i + 1) * Sig.valbits))
                            invalidCount = val.equals(h.vals[i]).not().toField().add(invalidCount)
                        }
                        return invalidCount
                    })(),
                    (() => {
                        return Field(0)
                    })(),
                ).assertEquals(0)
            }
        },
    }
})


// interface BitcoinHeaderAsFieldElements extends AsFieldElements<BitcoinHeader> {
//     new(...args: any[]): any
// }

// export class BitcoinHeader implements StaticImplements<BitcoinHeaderAsFieldElements, typeof BitcoinHeader> {
//     version: Field // 4 bytes
//     hashPrevBlock: Field // 32 bytes
//     hashMerkleRoot: Field // 32 bytes
//     time: Field // 4 bytes: timestamp in seconds
//     bits: Field // 4 bytes
//     nonce: Field // 4 bytes

//     constructor(version: Field, hashPrevBlock: Field, hashMerkleRoot: Field, time: Field, bits: Field, nonce: Field) {
//         this.version = version
//         this.hashPrevBlock = hashPrevBlock
//         this.hashMerkleRoot = hashMerkleRoot
//         this.time = time
//         this.bits = bits
//         this.nonce = nonce
//     }
// }