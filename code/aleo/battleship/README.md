# battleship.aleo

## Build Guide

To compile this Aleo program, run:
```bash
leo build
```

## Play
```bash
./run.sh reset # reset gameplay state

./run.sh a new # create new game for player a
./run.sh b new # create new game for player b

./run.sh a offer        # player a makes an offer to player b
./run.sh b accept_offer # player b accepts an offer from player a

./run.sh a play 01  # player a makes first move
./run.sh b play 55  # player b makes second move
./run.sh a play 31  # player a makes third move
./run.sh a play 27  # player b makes fourth move
...

```