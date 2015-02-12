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
var ICON_URL = 'https://www.evernote.com/shard/s1/sh/' +
  '76f01871-af74-4a04-ba2f-4a7bc4211138/03f89a375e59f4bfe1b2a1302f97413b/' +
  'deep/0/Mix-by-FiftyThree.png';

// Helpers
var postToSlack = function (params) {
  var user = params.user;
  var channel = params.channel;
  var imageURL = params.imageURL;
  var query = params.query;

  if (typeof user !== 'string') {
    throw new Error('`user` must be a string; got ' + channel);
  }

  if (typeof channel !== 'string') {
    throw new Error('`channel` must be a string; got ' + channel);
  }

  if (typeof imageURL !== 'string') {
    throw new Error('`imageURL` must be a string; got ' + channel);
  }

  if (typeof query !== 'string') {
    throw new Error('`query` must be a string; got ' + channel);
  }

  if (channel === 'directmessage') {
    channel = '@' + user;
  } else {
    channel = '#' + channel;
  }

  var payload = {
    channel: channel,
    username: 'Mix',
    icon_url: ICON_URL,
    attachments: [{
      fallback: 'Random creation on Mix',
      text: '@' + user + ' searched for _' + query + '_ to share this ' +
        'random creation of *' + params.author + '*.',
      image_url: imageURL
    }]
  };

  var options = {
    url: process.env.SLACK_WEBHOOK_URL,
    method: 'POST',
    json: payload
  };

  console.log('Post to Slack webhook:', payload);
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

  console.log('Received payload:', req.body);

  var query = req.body.text;
  Request.get({
    url: 'https://mix-internal-api.fiftythree.com/users/search?q=' +
      encodeURIComponent(query) + '&include=creations*100',
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

      if (response.body.items.length === 0) {
        res.status(200).send('Couldn’t find users for query ‘' + query + '’.');
        return;
      }

      var creations = response.body.items[0].creations.items;

      if (!Array.isArray(creations)) {
        res.status(400).send('Unexpected Mix API response: ' +
          '`items` not an array');
      }

      var randomIndex = Math.floor(Math.random() * creations.length);
      var randomCreation = creations[randomIndex];
      var randomImageURL = randomCreation.imageURLs['1024x768/jpeg'];

      postToSlack({
        channel: req.body.channel_name,
        imageURL: randomImageURL,
        query: query,
        user: req.body.user_name,
        author: randomCreation.creator.fullName
      });
      res.send(200);
  });
});

var PORT = parseInt(process.env.PORT, 10) || 8142;
console.log('Slack Mix integration running on http://localhost:' + PORT);
app.listen(PORT);
