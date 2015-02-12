var bodyParser = require('body-parser');
var express = require('express');
var Request = require('request');

var REQUIRED_ENVIRONMENT_VARIABLES = [
  'SLACK_WEBHOOK_URL',
  'SLACK_VERIFICATION_TOKEN'
];

REQUIRED_ENVIRONMENT_VARIABLES.forEach(function (variable) {
  if (!process.env[variable]) {
    throw new Error('`' + variable + '` environment variable required.');
  }
});

// Constants
var SLACK_VERIFICATION_TOKEN = process.env.SLACK_VERIFICATION_TOKEN;


// Helpers
var postToSlack = function (channel, imageURL) {
  if (typeof channel !== 'string') {
    throw new Error('`channel` must be a string; got ' + channel);
  }

  if (typeof imageURL !== 'string') {
    throw new Error('`imageURL` must be a string; got ' + channel);
  }

  var payload = '<' + imageURL + '>';

  var options = {
    url: process.env.SLACK_WEBHOOK_URL,
    method: 'POST',
    json: {
      channel: '#' + channel,
      text: payload
    }
  };

  console.log('Post to Slack webhook:', options);
  Request(options);
};

// App
var app = express();
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', function (req, res) {
  res.send('Hello, I am Slack Mix bot.');
});

app.post('/random-creation', function (req, res) {
  if (req.body.token !== SLACK_VERIFICATION_TOKEN) {
    res.status(403).send('Invalid Slack verification token.');
    return;
  }

  if (req.body.command !== '/mix') {
    res.status(400).send('Invalid command: ' + req.body.command);
    return;
  }

  var user = req.body.text;
  Request.get({
    url: 'https://mix-internal-api.fiftythree.com/users/' + user + '/creations',
    json: true
  }, function (error, response) {
      if (error) {
        res.status(400).send('Error: ' + error.message);
        return;
      }

      if (response.statusCode !== 200) {
        res.status(400).send('Unexpected status code from Mix API: ' +
            response.statusCode);
        return;
      }

      var creations = response.body.items;

      if (!Array.isArray(creations)) {
        res.status(400).send('Unexpected Mix API response: ' +
          '`items` not an array');
      }

      var randomIndex = Math.floor(Math.random() * creations.length);
      var randomCreation = creations[randomIndex];
      var randomImageURL = randomCreation.imageURLs['512x384/jpeg'];

      postToSlack(req.body.channel, randomImageURL);
      res.send(200);
  });
});

var PORT = parseInt(process.env.PORT, 10) || 8142;
console.log('Slack Mix integration running on http://localhost:' + PORT);
app.listen(PORT);
