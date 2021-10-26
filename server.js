const express = require('express');
var bodyParser = require('body-parser');
const app = express(), port = process.env.PORT || 3000 ;
var jsonParser = bodyParser.json();
const { default: axios } = require('axios');
const fs = require('fs');

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
    axios.get("https://htf-2021.herokuapp.com/testdata.json").then((response)=>{
        var oData = response.data;
        let solution = {
            "wapen": oData.wapens[_getRandomInt(oData.wapens.length)],
            "dader": oData.daders[_getRandomInt(oData.daders.length)],
            "kamer": oData.kamers[_getRandomInt(oData.kamers.length)]
        }
        if(solution != null && solution != undefined){
            fs.writeFileSync('solution.json', JSON.stringify(solution));
            console.log("Solution created");
        } else {
            console.error("Could not create solution");
        }
    }).catch((e)=>{
        console.error(`Error: ${e}`);
    });
});

app.post('/move_player', jsonParser, (req, res) => {
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
});

app.post('/check_answer', jsonParser, (req, res) => {
    var currentAnswer = req.body;
    let rawdata = fs.readFileSync('solution.json').toString();
    var solution = JSON.parse(rawdata);
    var response = {
        wapen: _checkWapen(currentAnswer.wapen, solution.wapen),
        dader: _checkDader(currentAnswer.dader, solution.dader),
        kamer: _checkKamer(currentAnswer.kamer, solution.kamer)
    };
    res.send(response);
});

function _checkWapen(caWapen, soWapen){
    if(caWapen.id === soWapen.id){
        return true
    } else {
        return false
    }
}

function _checkDader(caDader, soDader){
    if(caDader.id === soDader.id){
        return true
    } else {
        return false
    }
}

function _checkKamer(caKamer, soKamer){
    if(caKamer.id === soKamer.id){
        return true
    } else {
        return false
    }
}

function _getRandomInt(max) {
    return Math.floor(Math.random() * max);
}

app.listen(port, () => console.log(`Listening at port ${port}`));