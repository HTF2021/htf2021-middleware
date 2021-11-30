const express = require('express');
var bodyParser = require('body-parser');
const app = express(), port = process.env.PORT || 3000 ;
var jsonParser = bodyParser.json();
const { default: axios } = require('axios');
const fs = require('fs');
const { callbackify } = require('util');
const ROUNDS_KILLER_INACTIVE = 5;

app.use(express.urlencoded());
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
});

app.get('/data', function (req, res) {
    // FIXME: REQUIRED 1
    // Get gamedata from "https://htf-2021.herokuapp.com/testdata.json" using axios and send data to frontend
});

app.post('/new_solution', async function (req, res) {
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
    // FIXME: REQUIRED 2
    // Get random objects from oData by using random generator (_getRandomInt)
    return {
        "wapen": "",
        "dader": "",
        "kamer": ""
    }
}

async function _handleBotData(playerData){
    var botGuesses = [];
    var botLocations = [];
    var botChecks = [];
    let roomsUsed = [];
    for(var i = 0; i < playerData.botStatuses.length; i++){ // For each bot
        if(playerData.botStatuses[i]){
            const tempGuess = await _makeGuess(roomsUsed);        
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
            // TODO: BONUS 2.0
            // Make smart bot: bot learns from its guesses and keeps correct answers!
        }  
    }
    return {
        botChecks: botChecks,
        botStatuses: playerData.botStatuses,
        botLocations: botLocations
    }
}

async function _checkStatus(playerData, kamerId){
    let rawdata = fs.readFileSync(`gamedata/guesses_player.json`).toString(); // Read data
    var playerGuesses = JSON.parse(rawdata);
    if(playerData.killerActivated && playerGuesses.guesses.length >= ROUNDS_KILLER_INACTIVE){
        // TODO: BONUS 2.0
        // Make the killer play its own turn, then check if he is in the same room as the player. Return true if player survives, else return false.
        // Killer active
    } else {
        // Killer not active 
        return true;
    }
}

async function _makeGuess(roomsUsed){
    const tempGuess = await _createSolution();
    if(!roomsUsed.includes(tempGuess.kamer.id)){
        return tempGuess;
    } else {
        return _makeGuess(roomsUsed);
    }
}

function _checkData(currentAnswer){
    let rawdata = fs.readFileSync('gamedata/solution.json').toString();
    var solution = JSON.parse(rawdata);
    // FIXME: REQUIRED 3
    // Check object with existing (!) check functions. Return value should be true || false
    return {
        wapen: "",
        dader: "",
        kamer: ""
    };
}

function _writeGuess(currentAnswer, filePath){
    // FIXME: REQUIRED 4
    // Read content of file (filepath). Add current guess, then write the adjusted content to (filepath).
    // Tip: use 'fs'
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

function _parseBotStatuses(statuses){
    let parsedvalues = [];
    statuses.forEach(element => {
        parsedvalues.push((element === 'true'))
    });
    return parsedvalues;
}

app.listen(port, () => console.log(`Listening at port ${port}`));