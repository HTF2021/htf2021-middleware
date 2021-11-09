const express = require('express');
var bodyParser = require('body-parser');
const app = express(), port = process.env.PORT || 3000 ;
var jsonParser = bodyParser.json();
const { default: axios } = require('axios');
const fs = require('fs');
const { callbackify } = require('util');
const ROUNDS_KILLER_INACTIVE = 5;

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
    _clearLocalFiles();
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

function _clearLocalFiles(){
    var guesses = {"guesses": []};
    var location = {"location":[]};
    // Player
    fs.writeFileSync('gamedata/guesses_player.json', JSON.stringify(guesses));
    // Bots
    for(var i = 0; i < 4; i++){
        fs.writeFileSync(`gamedata/guesses_bot${i+1}.json`, JSON.stringify(guesses));
    }
    // Killer
    fs.writeFileSync('gamedata/killer_location.json', JSON.stringify(location));
}

function _createSolution(oData){
    return {
        "wapen": oData.wapens[_getRandomInt(oData.wapens.length)],
        "dader": oData.daders[_getRandomInt(oData.daders.length)],
        "kamer": oData.kamers[_getRandomInt(oData.kamers.length)]
    }
}

function _checkKillerKillsPlayer(killerLocation, playerData){
    let rawdata = fs.readFileSync(`gamedata/guesses_player.json`).toString(); // Read data
    var playerGuesses = JSON.parse(rawdata);
    if(playerData.killerActivated && playerGuesses.guesses.length >= ROUNDS_KILLER_INACTIVE){ 
        // Killer active
        if(killerLocation === playerData.answer.kamer.id){
            return true;
        } else {
            return false;
        }
    } else {
        // Killer not (yet) active 
        return false;
    }
}

function _checkKillerKillsBot(playerData, killerLocation, botKamerId){
    let rawdata = fs.readFileSync(`gamedata/guesses_player.json`).toString(); // Read data
    var playerGuesses = JSON.parse(rawdata);
    if(playerData.killerActivated && playerGuesses.guesses.length >= ROUNDS_KILLER_INACTIVE){ 
        // Killer active
        if(killerLocation === botKamerId){
            return true;
        } else {
            return false;
        }
    } else {
        // Killer not (yet) active 
        return false;
    }
}


app.post('/check_answer', jsonParser, (req, res) => {
    var playerData = req.body.data;
    var checks, botGuesses, newBotStatuses, response;
    // Check player guess
    checks = _checkData(playerData);

    // Bots & Killer logic
    axios.get("https://htf-2021.herokuapp.com/testdata.json").then((resp)=>{
        var oData = resp.data;    
        // Killer kills player logic
        var killerLocation = _createSolution(oData).kamer.id;
        if(_checkKillerKillsPlayer(killerLocation, playerData)){
            let game_status = {
                status: "game over"
            }
            res.send(game_status);
        }
        // Check bots activated
        if(playerData.amountOfBots > 0){
            botGuesses = [];
            newBotStatuses = [];
            for(var i = 1; i <= playerData.amountOfBots; i++){ // For each bot
                let rawdata = fs.readFileSync(`gamedata/guesses_bot${i}.json`).toString(); // Read past guesses
                var guesses = JSON.parse(rawdata);
                if(playerData.botStatuses == undefined || playerData.botStatuses == null){ // initial botstatus = true -> alive
                    playerData.botStatuses = [true, true, true, true];
                }
                if(playerData.botStatuses[i-1] || (playerData.botStatuses[i-1] === 'true')){ // status = true -> bot is alive
                    let tempGuess;
                    do {
                        tempGuess = _createSolution(oData);
                    } while(_checkKamer(tempGuess.kamer, playerData.answer.kamer));
                    if(_checkKillerKillsBot(playerData, killerLocation, tempGuess.kamer.id)){
                        newBotStatuses.push(false); // dead = false
                        botGuesses.push({});
                    } else {
                        newBotStatuses.push(true);
                        botGuesses.push(tempGuess); // Create new guess instance
                    }
                } else {
                    // status = false -> bot is dead
                    newBotStatuses.push(false); // dead = false
                    botGuesses.push({});
                }
                guesses.guesses = []; // REMOVE CLEAR FOR MORE GUESSES --> SMART BOT
                guesses.guesses.push(botGuesses);
                if(botGuesses != null && botGuesses != undefined){
                    fs.writeFileSync(`gamedata/guesses_bot${i}.json`, JSON.stringify(guesses)); // Write new guess
                }
            }
            response = {
                checks: checks,
                botGuesses: botGuesses,
                botStatuses: newBotStatuses
            }
            res.send(response);
            _writePlayerGuess(playerData.answer);
        } else {
            response = {
                checks: checks
            }
            res.send(response);
            _writePlayerGuess(playerData.answer);
        }
    }).catch((e)=>{
        console.error(`Error: ${e}`);
    });
});

function _checkData(oData){
    var currentAnswer = oData.answer;
    let rawdata = fs.readFileSync('gamedata/solution.json').toString();
    var solution = JSON.parse(rawdata);
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