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

app.get('/new_solution', async function (req, res) {
    try{
        // reset game
        _clearLocalFiles();
        // generate new solution
        let solution = await _createSolution();
        fs.writeFileSync('gamedata/solution.json', JSON.stringify(solution));
        console.log("Solution created");
        res.send(true);
    } catch(e){
        console.error("Could not create solution");
        res.send(false);
    }
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

async function _createSolution(){
    var resp = await axios.get("https://htf-2021.herokuapp.com/testdata.json");
    var oData = resp.data;
    return {
        "wapen": oData.wapens[_getRandomInt(oData.wapens.length)],
        "dader": oData.daders[_getRandomInt(oData.daders.length)],
        "kamer": oData.kamers[_getRandomInt(oData.kamers.length)]
    }
}

async function _checkStatus(playerData, kamerId){
    let rawdata = fs.readFileSync(`gamedata/guesses_player.json`).toString(); // Read data
    var playerGuesses = JSON.parse(rawdata);
    if(playerData.killerActivated && playerGuesses.guesses.length >= ROUNDS_KILLER_INACTIVE){
        // Killer active
        if(!playerData.killerLocation){ // Create Killer location if not existing yet
            let killerLocation = await _createSolution();
            playerData.killerLocation = await killerLocation.kamer.id;
        }
        if(playerData.killerLocation === kamerId){
            return false; // false == dead, true == alive
        } else {
            return true;
        }
    } else {
        // Killer not (yet) active 
        return true;
    }
}

async function _handleBotData(playerData){
    var botGuesses = [];
    var botLocations = [];
    var botChecks = [];
    var botStatuses = [];
    var tempGuess;

    for(var i = 0; i < playerData.amountOfBots; i++){ // For each bot
        // Create bot guess
        // Note: Only one player or bot can be in a room
        if(i === 0){
            do {
                tempGuess = await _createSolution();
            } while(_checkKamer(tempGuess.kamer, playerData.answer.kamer));
        } else {
            do {
                tempGuess = await _createSolution();
            } while(_checkKamer(tempGuess.kamer, playerData.answer.kamer) && !_checkBotKamers(tempGuess.kamer, botGuesses));
        }
        // save valid temp guess
        botGuesses[i] = tempGuess;
        // save bot location
        botLocations[i] = botGuesses[i].kamer.id;
        // Check Bot guess
        botChecks[i] = _checkData(botGuesses[i]);

        // Check bot status (dead or alive)
        if(playerData.botStatuses == undefined || playerData.botStatuses == null){ // if initial: game starts
            botStatuses = [true, true, true, true];
        } else {
            botStatuses[i] = _checkStatus(playerData, botGuesses[i].kamer.id);
        }

        // Write bot guess
        _writeGuess(botGuesses[i], `gamedata/guesses_bot${i+1}.json`);
    }
    return {
        botChecks: botChecks,
        botStatuses: botStatuses,
        botLocations: botLocations
    }
}

function _checkBotKamers(caKamer, botGuesses){
    let unique = true;
    caKamer = parseInt(caKamer.id);
    for(let i = 0; i < botGuesses.length; i++){
        if(caKamer === botGuesses[i].kamer.id){
            unique = false
        }
    }
    return unique;
}

app.post('/check_answer', jsonParser, async (req, res) => {
    var playerData = req.body.data;
    var response;
    var statuses = {};
    var checks = {};
    // Check player guess
    checks.player = _checkData(playerData.answer);

    // Check player status (dead or alive)
    statuses.player = _checkStatus(playerData, playerData.answer.kamer.id);

    // Create response
    response = {
        statuses: statuses,
        checks: checks
    };

    // Write player guess
    _writeGuess(playerData.answer, 'gamedata/guesses_player.json');

    // Create bots & check bot data
    if(playerData.amountOfBots > 0){
        let botData = await _handleBotData(playerData);
        response.checks.bots = botData.botChecks;
        response.statuses.bots = botData.botStatuses;
        response.botLocations = botData.botLocations;
        res.send(response);
    } else {
        res.send(response);
    }
});

function _checkData(currentAnswer){
    let rawdata = fs.readFileSync('gamedata/solution.json').toString();
    var solution = JSON.parse(rawdata);
    return {
        wapen: _checkWapen(currentAnswer.wapen, solution.wapen),
        dader: _checkDader(currentAnswer.dader, solution.dader),
        kamer: _checkKamer(currentAnswer.kamer, solution.kamer)
    };
}

function _writeGuess(currentAnswer, filePath){
    let rawdata = fs.readFileSync(filePath).toString();
    var guesses = JSON.parse(rawdata);
    guesses.guesses.push(currentAnswer);
    fs.writeFileSync(filePath, JSON.stringify(guesses));
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