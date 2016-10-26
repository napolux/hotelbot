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
            sendMessageToWit(event.sender.id, event);
            //evaluateCommand(event.sender.id, event.message.text);
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

// Codice per wit.ai
function sendMessageToWit(recipientId, event) {

  const sessionId = findOrCreateSession(recipientId);
  const {
      text,
      attachments
  } = event.message;

  // Inviamo i messaggi a Wit.ai 
  // Eseguiamo le azioni fino a quando non abbiamo più niente da eseguire
  wit.runActions(
      sessionId, // sessione utente
      text, // messaggio
      sessions[sessionId].context // context sessione utente
  ).then((context) => {
        console.log('Azioni...');
        // Ok, abbiamo fatto tutto.
        // Aspettiamo nuovi messaggi.
        console.log('Aspettiamo nuovi messaggi...');

        // Updating the user's current session state
        sessions[sessionId].context = context;
      })
      .catch((err) => {
        var reply = "Mi spiace, non riesco a capirti... :-(";
        sendTextMessage(recipientId, reply);
        console.error('Oops! C\'è stato un problema! ', err.stack || err);
      })

}

const sessions = {};

const findOrCreateSession = (fbid) => {
    let sessionId;
    // Controlliamo se abbiamo una sessione utente
    Object.keys(sessions).forEach(k => {
        if (sessions[k].fbid === fbid) {
        // Eccolo
        sessionId = k;
    }
});
if (!sessionId) {
    // Sessione non trovata, ne creiamo una nuova
    sessionId = new Date().toISOString();
    sessions[sessionId] = {
        fbid: fbid,
        context: {}
    };
}
return sessionId;
};

// Le azioni del nostro bot
const actions = {
    send({
        sessionId
    }, {
        text
    }) {
    // Il nostro bot ha qualcosa da dire!
    // Recuperiamo l'id utente dalla sessione
    const recipientId = sessions[sessionId].fbid;
    if (recipientId) {
        // Utente trovato, inviamo il messaggio all'utente dopo l'esecuzione delle azioni
        return new Promise(function(resolve, reject) {
            sendTextMessage(recipientId, text);
            return resolve();
        });
    } else {
        console.error('Oops! Non ho trovato:', sessionId);
        // Giving the wheel back to our bot
        return Promise.resolve()
    }
},
// Salutiamo, perché il bot è educato
getHello({
    context,
    entities
}) {
    return new Promise(function(resolve, reject) {

        var saluto = firstEntityValue(entities, 'saluti');

        if(saluto && !context.rooms) {
            context.greetings = "Ciao, come posso aiutarti?";
        } else {
            delete context.greetings;
        }

        console.log("CONTEXT " + JSON.stringify(context));
        return resolve(context);
    });
},
clearContext({
    context,
    entities
}) {
    return new Promise(function(resolve, reject) {

        delete context.greetings;
        
        console.log("CONTEXT " + JSON.stringify(context));
        return resolve(context);
    });
},
sendReceipt({
    context,
    entities
}) {
    return new Promise(function(resolve, reject) {

        // Inviamo una ricevuta
        console.log("Invio ricevuta");

        console.log("sessions: " +  sessions);

        console.log("CONTEXT " + JSON.stringify(context));
        return resolve(context);
    });
},
bookRoom({
    context,
    entities
}) {
    return new Promise(function(resolve, reject) {

        var numberOfRooms = firstEntityValue(entities, 'number');

        if(numberOfRooms) {
            context.rooms = numberOfRooms;
        } else {
            context.rooms = 0;
        }

        console.log("CONTEXT " + JSON.stringify(context));
        return resolve(context);
    });
},
saveBooking({
    context,
    entities
}) {
    return new Promise(function(resolve, reject) {
        var numberOfNights = firstEntityValue(entities, 'number');

        context.nights = numberOfNights;

        console.log("CONTEXT " + JSON.stringify(context));

        if(context.nights && context.rooms) {

        // Connessione al server
        MongoClient.connect(url, function (err, db) {
          if (err) {
            console.log('Impossibile connettersi. Errore:', err);
          } else {
            // Siamo connessi! :)
            console.log('Connessione stabilita con: ', url);
            
            // Recuperiamo le prenotazioni
            var collection = db.collection('prenotazioni');

            // Creiamo la prenotazione
            var prenotazione = {nome: 'Mario Rossi', notti: context.nights, stanze: context.rooms};
            
            // Insert some users
            collection.insert([prenotazione], function (err, result) {
              if (err) {
                console.log(err);
              } else {
                console.log("Inserimento avvenuto con successo");
              }
              //Close connection
              db.close();
            });

          }
        });
            
        }

        

        return resolve(context);
    });
},
};

// Setup del bot
const wit = new Wit({
    accessToken: WIT_ACCESS_TOKEN,
    actions,
    logger: new log.Logger(log.INFO)
});


// Controllo entità
const firstEntityValue = (entities, entity) => {
  const val = entities && entities[entity] &&
    Array.isArray(entities[entity]) &&
    entities[entity].length > 0 &&
    entities[entity][0].value
  ;
  if (!val) {
    return null;
  }
  return typeof val === 'object' ? val.value : val;
};

