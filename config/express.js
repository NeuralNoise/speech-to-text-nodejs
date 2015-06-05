/**
 * Copyright 2014 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// Module dependencies
var express    = require('express'),
  apiProxy     = require('http-proxy').createProxyServer(),
  errorhandler = require('errorhandler'),
  request      = require('request'),
  bodyParser   = require('body-parser'),
  fs           = require('fs');

module.exports = function (app, speechToText, credentials) {
  
  console.log('module credentials', credentials);

  // Configure Express
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());


  // Setup static public directory
  app.use(express.static(__dirname + '/../public'));
  app.set('view engine', 'jade');
  app.set('views', __dirname + '/../views');

  // Add error handling in dev
  if (!process.env.VCAP_SERVICES) {
    app.use(errorhandler());
  }

  app.get('/token', function(req, res) {
    request.get({'url': 
      credentials.authenticationUrl + '/v1/token?url=https://stream-d.watsonplatform.net/text-to-speech-beta/api',
      'auth': {
        'user': credentials.username,
        'pass': credentials.password,
        'sendImmediately': false
      }}, function(err, response, body) {
        res.send(body);
      }
    );
  });


  // render index page
  app.get('/', function(req, res) {
    res.render('index');
  });

  app.post('/', function(req, res) {
    var audio;

    if(req.body.url && req.body.url.indexOf('audio/') === 0) {
      // sample audio
      audio = fs.createReadStream(__dirname + '/../public/' + req.body.url);
    } else {
      // malformed url
      return res.status(500).json({ error: 'Malformed URL' });
    }

    speechToText.recognize({audio: audio, content_type: 'audio/l16; rate=44100'}, function(err, transcript){
      if (err)
        return res.status(500).json({ error: err });
      else
        return res.json(transcript);
    });
  });

  var creds = new Buffer(credentials.username + ':' + credentials.password).toString('base64');

  app.get('/v1/*', function(req, res) {
    req.headers['Authorization'] = 'Basic ' + creds;
    apiProxy.web(req, res, { target: credentials.url, secure: false } );
    apiProxy.on('error', function(err) {
      console.log('err', err);
    });
  });

};
