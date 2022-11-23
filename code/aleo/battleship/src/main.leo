// The 'battleship' program.
program battleship.aleo {
    // reference implementation: https://github.com/demox-labs/zk-battleship

    // render = lambda v: print("\n".join(map(lambda i: "{:064b}".format(v)[8*i:8*(i+1)].replace("", " "), range(8))))

    // Battleship boards are represented by 8x8 squares
    // A u64 is is required to represent a hit or a miss on a single board
    // Starting from the top row, left to right, a hit is 1 and a miss is 0
    // A first move resulting in a hit in row 1, column 3 would b:
    // 00100000 00000000 00000000 00000000 00000000 00000000 00000000 00000000
    // A second u64 is needed to represent which squares have been played
    //     with 1s being played squares, and 0s being unplayed squares
    record State {
        owner: address,
        gates: u64,
        player_1: address,
        player_2: address,
        ships: u64,         // ship bitstring representing all ship positions on your own board
        hits: u64,          // all hits registered on the opponent's board
        played: u64,        // squares that have been played on the opponent's board
        turns: u8,          // number of turns played so far by both players
    }

    record Move {
        owner: address,
        gates: u64,
        player_1: address,
        player_2: address,
        previous_hit: u64,
        incoming_fire: u64,
        turn: u8,
    }

    function bit_count(r0: u64) -> u64 {
        let r1: u64 = r0 / 2u64;
        let r2: u64 = r0 / 4u64;
        let r3: u64 = r0 / 8u64;
        let r4: u64 = r1 & 8608480567731124087u64;  // 0b0111011101110111011101110111011101110111011101110111011101110111
        let r5: u64 = r2 & 3689348814741910323u64;  // 0b0011001100110011001100110011001100110011001100110011001100110011
        let r6: u64 = r3 & 1229782938247303441u64;  // 0b0001000100010001000100010001000100010001000100010001000100010001
        let r7: u64 = r0 - r4;
        let r8: u64 = r7 - r5;
        let r9: u64 = r8 - r6;
        let r10: u64 = r9 / 16u64;
        let r11: u64 = r9 + r10;
        let r12: u64 = r11 & 1085102592571150095u64; // 0b0000111100001111000011110000111100001111000011110000111100001111
        let r13: u64 = r12 % 255u64;
        return r13;
    }

    function is_adjecent(
        placement: u64,
        bitstring: u64,
    ) -> bool {
        let r: u64 = placement / bitstring;
        r = r == 0u64 ? 3u64 : r;
        return r & (r - 1u64) == 0u64;
    }

    function is_horizontal(
        placement: u64,
        bitstring: u64,
    ) -> bool {
        let r: u64 = (placement % 255u64) / bitstring;
        r = r == 0u64 ? 3u64 : r;
        return r & (r - 1u64) == 0u64;
    }

    function is_valid_placement(
        placement: u64,     // ship's placement in 8x8 grid
        hor_bitstring: u64, // horizontal ship bitstring
        ver_bitstring: u64, // vertical ship bitstring
    ) -> bool {

        // if vertical
        let vadj: u64 = placement / ver_bitstring;  // may result in 0
        vadj = vadj == 0u64 ? 3u64 : vadj;     // subtracting 1 from 0 will cause an underflow, setting to 3 will guarantee failure
        let r8: bool = vadj & (vadj - 1u64) == 0u64; // adjacency check
        
        // if horizontal
        let hadj: u64 = placement / hor_bitstring;
        hadj = hadj == 0u64 ? 3u64 : hadj;
        let r5: bool = hadj & (hadj - 1u64) == 0u64; // adjacency check

        let hr: u64 = (placement % 255u64) / hor_bitstring;
        hr = hr == 0u64 ? 3u64 : hr; 
        let r6: bool = hr & (hr - 1u64) == 0u64; // horizontal check: true if bits are not split across rows

        return (r5 & r6) || r8;
    }

    function create_move(opponent: address, turn: u8) -> Move {
        return Move {
            owner: opponent,
            gates: 0u64,
            player_1: self.caller,
            player_2: opponent,
            previous_hit: 0u64,
            incoming_fire: 0u64,
            turn: turn,
        };
    }

    function start_game(state: State) -> State {
        return State {
            owner: state.owner,
            gates: state.gates,
            player_1: state.player_1,
            player_2: state.player_2,
            ships: state.ships,
            hits: state.hits,
            played: state.played,
            turns: 1u8,
        };
    }

    transition new(
        carrier: u64,      // length 5: placement in 8x8 grid
        battleship: u64,   // length 4
        cruiser: u64,      // length 3
        destroyer: u64,    // length 2
        opponent: address, // address of the opponent
    ) -> State {
        // ensure ships are of correct size
        console.assert_eq(5u64, bit_count(carrier));
        console.assert_eq(4u64, bit_count(battleship));
        console.assert_eq(3u64, bit_count(cruiser));
        console.assert_eq(2u64, bit_count(destroyer));

        // verify that each individual ship placement bitstring is valid
        console.assert_eq(true, is_valid_placement(carrier, 31u64, 4311810305u64));
        console.assert_eq(true, is_valid_placement(battleship, 15u64, 16843009u64));
        console.assert_eq(true, is_valid_placement(cruiser, 7u64, 65793u64));
        console.assert_eq(true, is_valid_placement(destroyer, 3u64, 257u64));

        // create the board with all the ship placements combined
        let ships: u64 = carrier.or(battleship).or(cruiser).or(destroyer);

        console.assert_eq(14u64, bit_count(ships));

        return State {
            owner: self.caller,
            gates: 0u64,
            player_1: self.caller,
            player_2: opponent,
            ships: ships,
            hits: 0u64,
            played: 0u64,
            turns: 0u8,
        };
    }

    // input r0 (board_state.record): the board record to start a game with.
    // returns an updated board state record that has been started. This board cannot be used to start any other games.
    // returns a dummy move record owned by the opponent.
    // This function commits a given board to a game with an opponent and creates the initial dummy move.
    transition offer(
        state: State,
    ) -> (State, Move) {
        // ensure caller is player_1 on own board
        console.assert_eq(self.caller, state.player_1); 

        // ensure game has not started
        console.assert_eq(state.turns, 0u8);            

        let next_move: Move = Move {
            owner: state.player_2,
            gates: 0u64,
            player_1: state.player_1,
            player_2: state.player_2,
            previous_hit: 0u64,
            incoming_fire: 0u64,
            turn: 1u8,
        };

        let new_state: State = State {
            owner: state.owner,
            gates: state.gates,
            player_1: state.player_1,
            player_2: state.player_2,
            ships: state.ships,
            hits: state.hits,
            played: state.played,
            turns: next_move.turn,
        };

        return (new_state, next_move);
    }

    // input r0 (board_state.record): the board record to play the game with.
    // input r1 (move.record): move record to play to begin the game. This should be the dummy move record created
    // from offer_battleship.
    // returns updated board_state.record that has been started and can no longer be used to join or start new games.
    // returns dummy move record owned by the opponent.
    transition accept_offer(
        state: State,
        move: Move,
    ) -> (State, Move) {
        // ensure caller is player_1 on own board
        console.assert_eq(self.caller, state.player_1); 

        // ensure game has not started
        console.assert_eq(state.turns, 0u8);   
        
        // ensure it is a valid move
        console.assert_eq(move.turn, state.turns + 1u8);  
        console.assert_eq(move.player_1, state.player_2);
        console.assert_eq(move.player_2, state.player_1);

        let next_move: Move = Move {
            owner: state.player_2,
            gates: 0u64,
            player_1: state.player_1,
            player_2: state.player_2,
            previous_hit: 0u64,
            incoming_fire: 0u64,
            turn: move.turn + 1u8,
        };

        let new_state: State = State {
            owner: state.owner,
            gates: state.gates,
            player_1: state.player_1,
            player_2: state.player_2,
            ships: state.ships,
            hits: state.hits,
            played: state.played,
            turns: next_move.turn,
        };

        return (new_state, next_move);
    }

    // input state (State): the game state to update
    // input move (Move): the incoming move from the opponent
    // input fire_coordinate (u16): Two 3-bit numbers specifying (x, y) < (8, 8) coordinate in the board
    //       i.e (0, 2) -> 02u16 [Pos: 2u16], (5, 7) -> 57u16 [Pos: 2**(5*8+7)]
    // returns updated state
    // returns new move owned by opponent
    transition play(
        state: State,
        move: Move,
        fire_coordinate: u8,
    ) -> (State, Move) {
        // ensure caller is player_1 on own board
        console.assert_eq(self.caller, state.player_1); 

        // ensure game has started
        console.assert_eq(state.turns > 0u8, true);

        // ensure it's a valid move
        console.assert_eq(move.turn, state.turns + 1u8);  
        console.assert_eq(move.player_1, state.player_2);
        console.assert_eq(move.player_2, state.player_1);

        // map fire_coordinate to board position
        // ensure the coordinate lies inside 8x8 grid
        let fire: u64 = coordinate_to_bitmap(fire_coordinate);

        // fire on own board, fail if invalid move
        let is_fire_valid: bool = fire.
            and(fire - 1u64).eq(0u64).           // only one coordinate should be set
            and(fire.and(state.played).eq(0u64)); // should not be already played coordinates
        console.assert_eq(is_fire_valid, true);

        // assess whether the incoming move firing coordinate is a hit
        let hit_or_miss: u64 = state.ships.and(move.incoming_fire);
        
        let next_player: address = 
            move.owner == move.player_1 ? move.player_2 : move.player_1;

        let new_state: State = State {
            owner: state.owner,
            gates: state.gates,
            hits: state.hits.or(move.previous_hit), // update own board with last shot
            played: state.played.or(fire),
            ships: state.ships,
            player_1: state.player_1,
            player_2: state.player_2,
            turns: move.turn,
        };

        let next_move: Move =  Move {
            owner: next_player,
            gates: 0u64,
            player_1: state.player_1,
            player_2: state.player_2,
            previous_hit: hit_or_miss,
            incoming_fire: fire,
            turn: move.turn + 1u8,
        };
    
        return (new_state, next_move);
    }


    function coordinate_to_bitmap(pos: u8) -> u64 {
        let d1: u8 = pos / 10u8;
        let d2: u8 = pos % 10u8;
        console.assert_eq(d1 < 8u8, true); // should not have 8 or 9 as 1st digit
        console.assert_eq(d2 < 8u8, true); // should not have 8 or 9 as 2nd digit
        return 2u64 ** (8u8 * d1 + d2);
    }
}