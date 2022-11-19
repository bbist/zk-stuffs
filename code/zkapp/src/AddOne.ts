import { SelfProof, Field, Experimental, verify } from 'snarkyjs';

export const AddOne = Experimental.ZkProgram({
  publicInput: Field,

  methods: {
    base: {
      privateInputs: [],

      method(publicInput: Field) {
        publicInput.assertEquals(Field(0));
      },
    },

    step: {
      privateInputs: [SelfProof, SelfProof],

      method(publicInput: Field, earlierProof: SelfProof<Field>, ep: SelfProof<Field>) {
        ep.verify()
        earlierProof.verify();
        earlierProof.publicInput.add(1).assertEquals(publicInput);
      },
    },
  },
});