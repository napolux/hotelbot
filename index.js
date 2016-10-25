// Inizializziamo i componenti dell'applicazione
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var app = express();
var mongodb = require('mongodb');

// Wit
var Wit = require('node-wit').Wit;
var log = require('node-wit').log;
var WIT_ACCESS_TOKEN = process.env.WIT_ACCESS_TOKEN;

// Connettiamoci a MongoDB.
var MongoClient = mongodb.MongoClient;

// URL precedentemente salvato dal plugin mlab.
var url = process.env.MONGODB_URI;


// Connessione al server
MongoClient.connect(url, function (err, db) {
  if (err) {
    console.log('Impossibile connettersi. Errore:', err);
  } else {
    // Siamo connessi! :)
    console.log('Connessione stabilita con: ', url);
    
    // Qui eseguiremo il nostro codice...

    db.close();
  }
});

// La cartella per i file statici
app.use(express.static('public'));

// Impostiamo bodyparser che ci permetterà di interpretare messaggi e confezionare payload
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

// L'applicazione sarà in ascolto sulla porta 3000 o su una porta predefinita dal server
app.listen((process.env.PORT || 3000));

// Homepage
app.get('/', function (req, res) {
    res.send('<h1>Questo è hotelbot</h1>');
});

// Facebook Webhook
app.get('/webhook', function (req, res) {
    if (req.query['hub.verify_token'] === 'ciao_io_programmo_sono_hotelbot') {
        res.send(req.query['hub.challenge']);
    } else {
        res.send('Token non valido');
    }
});

// Gestione degli eventi
app.post('/webhook', function (req, res) {
    var events = req.body.entry[0].messaging;
    for (i = 0; i < events.length; i++) {
        var event = events[i];
        if (event.message && event.message.text) {
            evaluateCommand(event.sender.id, event.message.text);
        } else if (event.postback) {
            // Abbiamo ricevuto una postback
        } else if (event.message && event.message.attachments) {
            // Gestione degli allegati
            sendTextMessage(event.sender.id, "Mi spiace, non posso gestire allegati!");
        }
    }
    res.sendStatus(200);
});

// Invia un messaggio di testo
function sendTextMessage(recipientId, text) {
    var msg = {
        "text": text
    };
    sendMessage(recipientId, msg)
}

// Invia messaggio multimediale
function sendMultimediaMessage(recipientId, type, url) {
    var msg = {
        "attachment": {
            "type": type,
            "payload": {
                "url": url
            }
        }
    };    

    sendMessage(recipientId, msg);
}

// Invia un messaggio generico
function sendMessage(recipientId, message) {
    request({
        url: 'https://graph.facebook.com/v2.7/me/messages',
        qs: {access_token: process.env.PAGE_ACCESS_TOKEN},
        method: 'POST',
        json: {
            recipient: {id: recipientId},
            message: message,
        }
    }, function(error, response, body) {
        if (error) {
            console.log('Errore nella spedizione del messaggio: ', error);
        } else if (response.body.error) {
            console.log('Errore: ', response.body.error);
        }
    });
};

// Gestione dei comandi
function evaluateCommand(recipientId, text) {
    command = text.toLowerCase();
    console.log("Comando ricevuto: " + command);
}


