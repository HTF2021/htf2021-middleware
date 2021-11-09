const express = require('express');
var bodyParser = require('body-parser');
const app = express(), port = process.env.PORT || 3000 ;
var jsonParser = bodyParser.json();
const { default: axios } = require('axios');
const fs = require('fs');
const { callbackify } = require('util');

app.use(express.static('public'));

app.use(bodyParser.urlencoded());
app.use(bodyParser.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

app.get('/data', function (req, res) {
    axios.get("https://htf-2021.herokuapp.com/testdata.json").then((response)=>{
        var oData = response.data;
        res.send(oData);
    }).catch((e)=>{
        console.log(`Error: ${e}`);
    });
});

app.get('/new_solution', function (req, res) {
    // reset game
    var guesses = {"guesses": []};
    fs.writeFileSync('gamedata/guesses_player.json', JSON.stringify(guesses));
    // generate new solution
    axios.get("https://htf-2021.herokuapp.com/testdata.json").then((response)=>{
        var oData = response.data;
        let solution = _createSolution(oData);
        if(solution != null && solution != undefined){
            fs.writeFileSync('gamedata/solution.json', JSON.stringify(solution));
            console.log("Solution created");
        } else {
            console.error("Could not create solution");
        }
    }).catch((e)=>{
        console.error(`Error: ${e}`);
    });
});

function _createSolution(oData){
    return {
        "wapen": oData.wapens[_getRandomInt(oData.wapens.length)],
        "dader": oData.daders[_getRandomInt(oData.daders.length)],
        "kamer": oData.kamers[_getRandomInt(oData.kamers.length)]
    }
}

/*app.post('/move_player', jsonParser, (req, res) => {
    if(req.body.player != undefined){ 
        // Read player positions
        var currentPosPlayer = req.body.player.currentPosition.id;
        var nextPosPlayer = req.body.player.nextPosition.id;

        // Set default player location
        var newPlayerLocation = currentPosPlayer;

        // Check player location
        if(currentPosPlayer != nextPosPlayer){
            newPlayerLocation = nextPosPlayer
            // Check bot location(s)
            if(req.body.bots.length > 0){ // If 1 or more bots in the game
                for(let i = 0; i < req.body.bots.length; i++){
                    let botLocation = req.body.bots[i].id;
                    if(botLocation == nextPosPlayer){ // If bot is in chosen room, reset to default
                        newPlayerLocation = currentPosPlayer;
                    }
                }
            }
            if(req.body.killer != undefined){ // If 1 killer in the game
                // check killer location
                let killerLocation = req.body.killer.id;
                if(killerLocation == nextPosPlayer){ // If bot is in chosen room, reset to default
                    newPlayerLocation = currentPosPlayer;
                }
            }
        }
        let position = {
            "id": newPlayerLocation
        }
        res.send(position);
    } else {
        console.log("No player location given.")
    }
});*/

app.post('/check_answer', jsonParser, (req, res) => {
    var playerData = req.body.data;
    var checks, botGuesses, response;

    checks = _checkData(playerData);

    // Check bots activated
    if(playerData.amountOfBots > 0){
        axios.get("https://htf-2021.herokuapp.com/testdata.json").then((response)=>{
            var oData = response.data;
            botGuesses = [];
            for(var i = 0; i < playerData.amountOfBots; i++){ // For each bot
                let rawdata = fs.readFileSync(`gamedata/guesses_bot${i+1}.json`).toString(); // Read data
                var guesses = JSON.parse(rawdata);
                let tempGuess;
                do {
                    tempGuess = _createSolution(oData);
                } while(_checkKamer(tempGuess.kamer, playerData.answer.kamer));
                botGuesses.push(tempGuess); // Create new guess instance
                guesses.guesses = []; // REMOVE CLEAR FOR MORE GUESSES --> SMART BOT
                guesses.guesses.push(botGuesses);
                if(botGuesses != null && botGuesses != undefined){
                    fs.writeFileSync(`gamedata/guesses_bot${i+1}.json`, JSON.stringify(guesses)); // Write new guess
                }
            }
            response = {
                checks: checks,
                botGuesses: botGuesses
            }
            res.send(response);
            _writePlayerGuess(playerData.answer);
        }).catch((e)=>{
            console.error(`Error: ${e}`);
        });
    } else {
        response = {
            checks: checks
        }
        res.send(response);
        _writePlayerGuess(playerData.answer);
    }
});

function _checkData(oData){
    var currentAnswer = oData.answer;
    let rawdata = fs.readFileSync('gamedata/solution.json').toString();
    var solution = JSON.parse(rawdata);
    console.log(currentAnswer);
    console.log(currentAnswer.wapen);
    console.log(solution);
    console.log(solution.wapen);
    return {
        wapen: _checkWapen(currentAnswer.wapen, solution.wapen),
        dader: _checkDader(currentAnswer.dader, solution.dader),
        kamer: _checkKamer(currentAnswer.kamer, solution.kamer)
    };
}

function _writePlayerGuess(currentAnswer){
    let rawdata = fs.readFileSync('gamedata/guesses_player.json').toString();
    var guesses = JSON.parse(rawdata);
    guesses.guesses.push(currentAnswer);
    fs.writeFileSync('gamedata/guesses_player.json', JSON.stringify(guesses));
}

function _checkWapen(caWapen, soWapen){
    caWapen = parseInt(caWapen.id);
    if(caWapen === soWapen.id){
        return true
    } else {
        return false
    }
}

function _checkDader(caDader, soDader){
    caDader = parseInt(caDader.id);
    if(caDader === soDader.id){
        return true
    } else {
        return false
    }
}

function _checkKamer(caKamer, soKamer){
    caKamer = parseInt(caKamer.id);
    if(caKamer === soKamer.id){
        return true
    } else {
        return false
    }
}

function _getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

app.listen(port, () => console.log(`Listening at port ${port}`));