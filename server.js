const express = require('express');
var bodyParser = require('body-parser');
const app = express(), port = process.env.PORT || 3000 ;
var jsonParser = bodyParser.json();
const { default: axios } = require('axios');
const fs = require('fs');
const { callbackify } = require('util');
const ROUNDS_KILLER_INACTIVE = 5;

app.use(express.static('public'));

app.use(express.urlencoded());
app.use(express.json());

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
            playerData.killerLocation = killerLocation.kamer.id;
        }
        playerData.killerLocation = parseInt(playerData.killerLocation);
        kamerId = parseInt(kamerId);
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

async function makeGuess(roomsUsed){
    const tempGuess = await _createSolution();
    if(!roomsUsed.includes(tempGuess.kamer.id)){
        return tempGuess;
    } else {
        return makeGuess(roomsUsed);
    }
}

async function _handleBotData(playerData){
    var botGuesses = [];
    var botLocations = [];
    var botChecks = [];
    let roomsUsed = [];
    for(var i = 0; i < playerData.botStatuses.length; i++){ // For each bot
        if(playerData.botStatuses[i]){
            const tempGuess = await makeGuess(roomsUsed);        
            roomsUsed.push(tempGuess.kamer.id);    
            
            // save valid temp guess
            botGuesses[i] = tempGuess;
            // save bot location
            botLocations[i] = botGuesses[i].kamer.name;
            // Check Bot guess
            botChecks[i] = _checkData(botGuesses[i]);
            // Check bot status (dead or alive)
            playerData.botStatuses[i] = await _checkStatus(playerData, botGuesses[i].kamer.id);
            // Write bot guess
            _writeGuess(botGuesses[i], `gamedata/guesses_bot${i+1}.json`);
        }  
    }
    return {
        botChecks: botChecks,
        botStatuses: playerData.botStatuses,
        botLocations: botLocations
    }
}

function _parseBotStatuses(statuses){
    let parsedvalues = [];
    statuses.forEach(element => {
        parsedvalues.push((element === 'true'))
    });
    return parsedvalues;
}

app.post('/check_answer', jsonParser, async (req, res) => {
    var playerData = req.body.data;
    var response;
    var statuses = {};
    var checks = {};

    // Convert values to boolean
    playerData.botStatuses = _parseBotStatuses(playerData.botStatuses);

    // Check player guess
    checks.player = _checkData(playerData.answer);

    // Check player status (dead or alive)
    statuses.player = await _checkStatus(playerData, playerData.answer.kamer.id);

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
    soKamer = parseInt(soKamer.id);
    if(caKamer === soKamer){
        return true
    } else {
        return false
    }
}

function _getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

app.listen(port, () => console.log(`Listening at port ${port}`));