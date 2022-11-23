#!/bin/bash

set -e

usage() {
    echo "run.sh [player_id] [new|offer|accept_offer|play]"
    exit 1
}

function reset() {
    echo '{"players":{},"steps":[]}' > play.json
}

if [ ! -f play.json ]; then
    reset
fi

function get_player_state() {
    jq -r ".players[\"$1\"]" play.json
}

function add_player() {
    local tmp_file=$(mktemp)
    jq ".players += { \"$1\": \"$2\" }" play.json > $tmp_file
    mv $tmp_file play.json
}

function get_step() {
    jq -r ".steps[$1]$2" play.json
}

function add_step() {
    local player="$1"
    local args=("${@:2}")
    if [[ ${#args[@]} -gt 0 ]]; then
        local tmp_file=$(mktemp)
        jq ".steps |= . + [{\"player\":\"$player\", \"state\":\"${args[0]}\", \"move\":\"${args[1]}\"}]" play.json > $tmp_file
        mv $tmp_file play.json
    fi
}

function ensure_player() {
    if [ "$player" == "null" ] || [ "$player" == "" ]; then
        echo "Please create a new game!"
        usage
    fi
}

function ensure_expected_player() {
    if [ "$player" != "$1" ]; then
        echo "Please create a new game!"
        usage
    fi
}

function ensure_state() {
    if [ "$state" == "null" ] || [ "$state" == "" ]; then
        echo "$@"
        usage
    fi
}

function ensure_move() {
    if [ "$move" == "null" ] || [ "$move" == "" ]; then
        echo "$@"
        usage
    fi
}

function ensure_not_playing() {
    if [ "$(get_player_state $player)" != "null" ]; then
        echo "Player ${player} is already playing! Please reset to start a new game."
        usage
    fi
}

function ensure_my_turn() {
    if [[ "$player" == "null" ]]; then
        usage
    fi
    local player_state=$(get_player_state "$player")
    if [[ "$player_state" == "null" ]]; then
        echo "Player ${player}: please create a new game!"
        usage
    fi
    local last_player="$(get_step -1 .player)"
    if [[ "$last_player" != "null" ]] && [[ "$player" == "$last_player" ]]; then
        echo "Player ${player}: not your turn!"
        exit 1
    fi
    local my_prev_player="$(get_step -2 .player)"
    if [[ "$my_prev_player" != "null" ]] && [[ "$player" != "$my_prev_player" ]]; then
        echo "Player ${player}: please create a new game!"
        usage
    fi
}

function get_opponent() {
    if [[ "$1" == "a" ]]; then
        echo b
    else
        echo a
    fi
}

function get_player_address() {
    cat players/$1/program.json | jq -r .development.address
}

function get_opponent_address() {
    get_player_address "$(get_opponent "$1")"
}

function prepare() {
    cp players/${player}/program.json .
}


function leo_run() {
    leo run "$@" | tr '\n' ' ' | grep -Po '{.*}' | sed 's/}  • {/}\n{/g'
}

player="$1"
cmd="$2"
if [ "$1" == "reset" ]; then
    cmd="$1"
fi

case "$cmd" in
new)
    ensure_player
    ensure_not_playing
    carrier="31u64"
    battleship="3840u64"
    cruiser="224u64"
    destroyer="12288u64"
    opponent=$(get_opponent_address $player)
    prepare
    IFS=$'\n' read -r -d '' -a out < <( leo_run new $carrier $battleship $cruiser $destroyer $opponent && printf '\0' )
    add_player "${player}" "${out[@]}"
    ;;
offer)
    ensure_my_turn
    state="$(get_player_state $player)"
    ensure_state "Player=${player}: please start a new game!"
    prepare
    IFS=$'\n' read -r -d '' -a out < <( leo_run offer "${state}" && printf '\0' )
    add_step "${player}" "${out[@]}"
    ;;
accept_offer)
    ensure_my_turn
    state="$(get_player_state $player)"
    ensure_state "Player=${player}: please start a new game!"
    move="$(get_step -1 .move)"
    ensure_move "Player=${player}: no existing offer to accept!"
    prepare
    IFS=$'\n' read -r -d '' -a out < <( leo_run accept_offer "${state}" "${move}" && printf '\0' )
    add_step "${player}" "${out[@]}"
    ;;
play)
    fire="$3"
    if [[ ! "$fire" =~ ^[0-7]{2}$ ]]; then
        echo "Player=${player}: invalid fire coordinate: ${fire}!"
        exit 1
    fi
    ensure_my_turn
    state="$(get_step -2 .state)"
    ensure_state "Player=${player}: please start a new game or offer/accept_offer!"
    move="$(get_step -1 .move)"
    ensure_move "Player=${player}: no offer made or received yet!"
    prepare
    IFS=$'\n' read -r -d '' -a out < <( leo_run play "${state}" "${move}" "${fire}u8" && printf '\0' )
    add_step "${player}" "${out[@]}"
    ;;
reset)
    reset
    ;;
*)
    usage
    ;;
esac
