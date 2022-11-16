import {
    Field,
    SmartContract,
    state,
    State,
    method,
    DeployArgs,
    Permissions,
    Poseidon,
} from 'snarkyjs';


export class SimpleContract extends SmartContract {
    @state(Field) num = State<Field>()
    @state(Field) secret = State<Field>()

    deploy(args: DeployArgs) {
        super.deploy(args);
        this.setPermissions({
            ...Permissions.default(),
            editState: Permissions.proofOrSignature(),
        });
    }

    @method init(salt: Field, firstSecret: Field) {
        this.num.set(Field(1));
        this.secret.set(Poseidon.hash([salt, firstSecret]))
    }

    @method incrementNum() {
        const currentState = this.num.get();
        this.num.assertEquals(currentState); // precondition that links this.num.get() to the actual on-chain state
        const newState = currentState.add(2);
        newState.assertEquals(currentState.add(2));
        this.num.set(newState);
    }

    @method incrementSecret(salt: Field, secret: Field) {
        const x = this.secret.get()
        this.secret.assertEquals(x)

        Poseidon.hash([salt, secret]).assertEquals(x)
        this.secret.set(Poseidon.hash([salt, secret.add(1)]))
    }
}