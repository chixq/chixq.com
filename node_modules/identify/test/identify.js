'use strict';
/* globals describe, it, before */

var fs = require('fs'),
    path = require('path'),
    cheerio = require('cheerio'),
    should = require('should');

var identify = require('../lib/identify'),
    fixture = path.join(__dirname, 'fixtures', 'index.html');

describe('identify', function() {
  var html = '';

  before(function(done) {
    fs.readFile(fixture, function(err, data) {
      if(err) { throw err; }
      html = data.toString();
      done();
    });
  });

  it('should set ID attributes on block elements', function() {
    var identified = identify(html),
        $ = cheerio.load(identified);

    should.not.exist($('body').attr('id'));
    $('div').first().attr('id').should.equal('div1');
    $('h1').first().attr('id').should.equal('the-wizard-of-oz');
  });

  it('should allow prepend an anchor if asked to', function() {
    var options = {anchor: true},
        identified = identify(html, options),
        $ = cheerio.load(identified);

    var children = $('#i-never-thought').children();
    children.first()[0].name.should.equal('a');
    children.first().attr('href').should.equal('#i-never-thought');
  });
});
